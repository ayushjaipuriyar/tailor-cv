import { execSync } from "child_process";
import fs from "fs";
import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

// Simple in-memory rate limiter (per IP). Works for single-process dev/server only.
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // requests per window
const rateMap = new Map<string, { count: number; resetAt: number }>();

// Max upload size (bytes)
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 5 * 1024 * 1024; // 5 MB default

// NOTE: API header auth removed per user request. Site auth will be enforced via middleware.

export const runtime = "nodejs";

// Accepts multipart/form-data with a `file` field. The file may be:
// - a .tex file -> we will tar+bzip2 it into archive.tar.bz2 containing main.tex
// - a .tar or .tar.bz2 archive -> we will forward it as-is

export async function POST(req: Request) {
	try {
		// Rate limiting per IP
		const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
		const now = Date.now();
		const ent = rateMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
		if (now > ent.resetAt) {
			ent.count = 0;
			ent.resetAt = now + RATE_LIMIT_WINDOW_MS;
		}
		ent.count++;
		rateMap.set(ip, ent);
		if (ent.count > RATE_LIMIT_MAX) {
			return new NextResponse("Too many requests", { status: 429 });
		}

		const contentType = req.headers.get("content-type") || "";
		if (!contentType.includes("multipart/form-data")) {
			return new NextResponse("Expected multipart/form-data", { status: 400 });
		}

		// Use web-standard form parsing (available in Node 18+ / Next.js runtime)
		const form = await req.formData();
		const file = form.get("file") as any;
		if (!file) return new NextResponse("Missing file field", { status: 400 });

		// Basic file validation
		const filename = String(file.name || "upload");
		const safeName = path.basename(filename);
		const lower = safeName.toLowerCase();
		// accept only certain extensions
		const allowed = [".tex", ".tar", ".tar.bz2", ".tbz2", ".tar.bz"];
		if (!allowed.some((ext) => lower.endsWith(ext))) {
			return new NextResponse("Unsupported file type", { status: 400 });
		}
		// check reported size if available
		if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
			return new NextResponse("Uploaded file is too large", { status: 413 });
		}

		// create temp working dir
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "latex-upload-"));
		const receivedPath = path.join(tmp, file.name || "upload");

		// write uploaded file to disk
		const stream = file.stream();
		const out = fs.createWriteStream(receivedPath);
		// convert Web ReadableStream -> Node Readable and pipe
		const nodeReadable = Readable.fromWeb(stream as any);
		await pipeline(nodeReadable, out);

	// Determine what to send to latexonline
	let archivePath = receivedPath;
	let workdir: string | undefined = undefined;
	const fileLower = (file.name || "").toLowerCase();
	if (fileLower.endsWith(".tex")) {
			// create archive.tar.bz2 with main.tex
			const tarPath = path.join(tmp, "archive.tar.bz2");
			try {
				// Ensure file is named main.tex inside tar
				workdir = path.join(tmp, "work");
				fs.mkdirSync(workdir);
				const mainPath = path.join(workdir, "main.tex");
				fs.copyFileSync(receivedPath, mainPath);
				execSync(`tar -cjf ${tarPath} -C ${workdir} main.tex`);
				archivePath = tarPath;
			} catch (e: any) {
				cleanup();
				return new NextResponse(
					`Failed to create tarball: ${e?.message || e}`,
					{ status: 500 }
				);
			}
		} else if (
			fileLower.endsWith(".tar.bz2") ||
			fileLower.endsWith(".tbz2") ||
			fileLower.endsWith(".tar.bz")
		) {
			// already compressed tar
			archivePath = receivedPath;
	} else if (fileLower.endsWith(".tar")) {
			// plain tar - we can forward as-is but some services expect bzip2; try forwarding as-is
			archivePath = receivedPath;
	} else {
			// Unknown extension: assume it's an archive; forward as-is
			archivePath = receivedPath;
		}

		// If caller only wants the archive back, return it directly
		const url = new URL(req.url);
		const onlyArchive =
			url.searchParams.get("onlyArchive") === "1" ||
			url.searchParams.get("onlyArchive") === "true";
		if (onlyArchive) {
			try {
				const fileBuf = fs.readFileSync(archivePath);
				const ext = path.extname(archivePath).toLowerCase();
				const ct =
					ext.includes(".bz2") || ext.includes(".tbz")
						? "application/x-bzip2"
						: "application/x-tar";
				return new NextResponse(Buffer.from(fileBuf), {
					status: 200,
					headers: {
						"Content-Type": ct,
						"Content-Disposition": `attachment; filename="${path.basename(
							archivePath
						)}"`,
					},
				});
			} catch (e: any) {
				cleanup();
				return new NextResponse(`Failed to read archive: ${e?.message || e}`, {
					status: 500,
				});
			}
		}

		// Post to latexonline /data endpoint
		const formOut = new FormData();
		// Read file into memory and append as a Blob so the web fetch in Node can encode multipart correctly
		const fileBuf = fs.readFileSync(archivePath);
		// Use global Blob (available in Node 18+) to ensure proper multipart encoding
		const blob = new Blob([fileBuf]);
		formOut.append("file", blob as any, path.basename(archivePath));

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 120_000);
		const resp = await fetch(
			`https://latexonline.cc/data?target=main.tex&force=true&command=pdflatex`,
			{ method: "POST", body: formOut as any, signal: controller.signal }
		);
		clearTimeout(timeout);

		let buf = await resp.arrayBuffer();
		const ct = resp.headers.get("content-type") || "";
		const isPdfHeader =
			buf.byteLength > 4 &&
			new TextDecoder("ascii").decode(new Uint8Array(buf.slice(0, 4))) ===
				"%PDF";

		// If compilation failed and we have a workdir (we created the archive from a .tex),
		// try to detect missing .sty errors in the log, attempt to fetch from CTAN,
		// add the .sty into the workdir, recreate the archive and retry once.
		if (!resp.ok && workdir) {
			const text = new TextDecoder("utf-8").decode(new Uint8Array(buf));
			// look for patterns like: File `fontawesome5.sty' not found
			const missing: string[] = [];
			for (const m of text.matchAll(/File `([^']+)\.sty' not found/g)) {
				if (m[1]) missing.push(m[1]);
			}
			if (missing.length > 0) {
				// attempt to fetch each missing .sty from CTAN mirrors
				let fetchedAny = false;
				for (const sty of Array.from(new Set(missing))) {
					try {
						const ctanUrl = `https://mirrors.ctan.org/macros/latex/contrib/${encodeURIComponent(
							sty
						)}/${encodeURIComponent(sty)}.sty`;
						const r = await fetch(ctanUrl, { method: "GET" });
						if (r.ok) {
							const content = await r.arrayBuffer();
							fs.writeFileSync(
								path.join(workdir, `${sty}.sty`),
								Buffer.from(content)
							);
							fetchedAny = true;
						}
					} catch (e: any) {
						// ignore per-style fetch errors
					}
				}
				if (fetchedAny) {
					// recreate archive and retry post once
					try {
						const tarPath2 = path.join(tmp, "archive_retry.tar.bz2");
						execSync(`tar -cjf ${tarPath2} -C ${workdir} main.tex`);
						archivePath = tarPath2;
						// rebuild formOut with new archive
						const fileBuf2 = fs.readFileSync(archivePath);
						const blob2 = new Blob([fileBuf2]);
						const formOut2 = new FormData();
						formOut2.append("file", blob2 as any, path.basename(archivePath));
						const ctrl2 = new AbortController();
						const tm2 = setTimeout(() => ctrl2.abort(), 120_000);
						const resp2 = await fetch(
							`https://latexonline.cc/data?target=main.tex&force=true&command=pdflatex`,
							{ method: "POST", body: formOut2 as any, signal: ctrl2.signal }
						);
						clearTimeout(tm2);
						buf = await resp2.arrayBuffer();
						const ct2 = resp2.headers.get("content-type") || "";
						const isPdf2 =
							buf.byteLength > 4 &&
							new TextDecoder("ascii").decode(
								new Uint8Array(buf.slice(0, 4))
							) === "%PDF";
						if (resp2.ok && (isPdf2 || /pdf/i.test(ct2))) {
							cleanup();
							return new NextResponse(Buffer.from(buf), {
								status: 200,
								headers: { "Content-Type": "application/pdf" },
							});
						}
						// else let fallthrough to return the latest log
					} catch (e: any) {
						// if retry fails, continue to return original log
					}
				}
			}
		}

		// cleanup temp files
		cleanup();

		if (resp.ok && (isPdfHeader || /pdf/i.test(ct))) {
			return new NextResponse(Buffer.from(buf), {
				status: 200,
				headers: { "Content-Type": "application/pdf" },
			});
		}

		// return the log text for debugging
		const text = new TextDecoder("utf-8").decode(new Uint8Array(buf));
		return new NextResponse(text, { status: resp.status });

		function cleanup() {
			try {
				fs.rmSync(tmp, { recursive: true, force: true });
			} catch {}
		}
	} catch (e: any) {
		// log full error server-side for debugging but return a generic message to clients
		try {
			console.error("/api/compile/upload error:", e);
		} catch {}
		return new NextResponse("Internal server error", { status: 500 });
	}
}
