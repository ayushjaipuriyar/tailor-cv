import { execSync } from "child_process";
import fs from "fs";
import { NextResponse } from "next/server";
import os from "os";
import path from "path";

export const runtime = "nodejs";

type CompileBody = {
	tex?: string;
	engine?: "pdflatex" | "xelatex" | "lualatex";
};

function inferEngine(tex: string): "pdflatex" | "xelatex" | "lualatex" {
	// Prefer xelatex for fontspec/polyglossia; lualatex if direct lua code
	if (/\\directlua\b/i.test(tex)) return "lualatex";
	if (
		/\\usepackage\{\s*fontspec\s*\}|\\setmainfont\b|polyglossia|xeCJK/i.test(
			tex
		)
	)
		return "xelatex";
	return "pdflatex";
}

export async function POST(req: Request) {
	try {
		const { tex, engine }: CompileBody = await req.json();
		if (!tex || !/\\documentclass/.test(tex)) {
			return new NextResponse("Invalid or missing LaTeX document", {
				status: 400,
			});
		}

		const initial = engine || inferEngine(tex) || "xelatex";
		const engines: Array<"pdflatex" | "xelatex" | "lualatex"> = [
			initial,
			"xelatex",
			"lualatex",
			"pdflatex",
		];
		const tried: Array<{ engine: string; status?: number; error?: string }> =
			[];

		for (const eng of engines.filter((v, i, a) => a.indexOf(v) === i)) {
			// Try POST first
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 40_000);
				const resp = await fetch(
					`https://latexonline.cc/compile?command=${encodeURIComponent(eng)}`,
					{
						method: "POST",
						headers: { "Content-Type": "application/x-www-form-urlencoded" },
						body: new URLSearchParams({ text: tex }).toString(),
						signal: controller.signal,
					}
				);
				clearTimeout(timeout);

				const contentType = resp.headers.get("content-type") || "";
				const buf = await resp.arrayBuffer();
				const isPdfHeader =
					buf.byteLength > 4 &&
					new TextDecoder("ascii").decode(new Uint8Array(buf.slice(0, 4))) ===
						"%PDF";
				const isPdfType = /pdf/i.test(contentType);
				if (resp.ok && (isPdfType || isPdfHeader)) {
					return new NextResponse(Buffer.from(buf), {
						status: 200,
						headers: {
							"Content-Type": "application/pdf",
							"Cache-Control": "no-cache",
						},
					});
				} else {
					const msg =
						isPdfType || isPdfHeader
							? "unexpected non-ok while PDF-like"
							: await safeText(buf);
					tried.push({ engine: eng, status: resp.status, error: msg });
				}
			} catch (e: any) {
				tried.push({ engine: eng, error: e?.message || String(e) });
			}

			// Fallback: GET with query string (force=true), in case POST is unsupported/flaky
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 40_000);
				const url = `https://latexonline.cc/compile?command=${encodeURIComponent(
					eng
				)}&force=true`;
				const resp = await fetch(
					url + `&` + new URLSearchParams({ text: tex }).toString(),
					{
						method: "GET",
						signal: controller.signal,
					}
				);
				clearTimeout(timeout);

				const contentType = resp.headers.get("content-type") || "";
				const buf = await resp.arrayBuffer();
				const isPdfHeader =
					buf.byteLength > 4 &&
					new TextDecoder("ascii").decode(new Uint8Array(buf.slice(0, 4))) ===
						"%PDF";
				const isPdfType = /pdf/i.test(contentType);
				if (resp.ok && (isPdfType || isPdfHeader)) {
					return new NextResponse(Buffer.from(buf), {
						status: 200,
						headers: {
							"Content-Type": "application/pdf",
							"Cache-Control": "no-cache",
						},
					});
				} else {
					const msg =
						isPdfType || isPdfHeader
							? "unexpected non-ok while PDF-like"
							: await safeText(buf);
					tried.push({ engine: eng, status: resp.status, error: msg });
				}
			} catch (e: any) {
				tried.push({ engine: eng, error: e?.message || String(e) });
			}
		}

		const hint = !/\\documentclass/.test(tex)
			? "Missing \\documentclass. "
			: "";
		// As a more robust fallback, try packaging main.tex into a bzip2-compressed tarball
		// and POST it to the latexonline `/data` endpoint which accepts archives.
		try {
			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "latex-"));
			const texPath = path.join(tmp, "main.tex");
			fs.writeFileSync(texPath, tex, "utf8");
			const tarPath = path.join(tmp, "archive.tar.bz2");
			// Create bzip2-compressed tarball (tar -cjf)
			try {
				execSync(`tar -cjf ${tarPath} -C ${tmp} main.tex`, {
					stdio: "inherit",
				});
			} catch (e) {
				// If tar isn't available or fails, rethrow to outer catch
				throw new Error(`tar creation failed: ${String(e)}`);
			}

			// POST multipart form with the tarball
			const form = new FormData();
			const stream = fs.createReadStream(tarPath);
			form.append("file", stream, "archive.tar.bz2");

			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 120_000);
			const resp = await fetch(
				`https://latexonline.cc/data?target=main.tex&force=true&command=pdflatex`,
				{ method: "POST", body: form as any, signal: controller.signal }
			);
			clearTimeout(timeout);

			const buf = await resp.arrayBuffer();
			const contentType = resp.headers.get("content-type") || "";
			const isPdfHeader =
				buf.byteLength > 4 &&
				new TextDecoder("ascii").decode(new Uint8Array(buf.slice(0, 4))) ===
					"%PDF";
			const isPdfType = /pdf/i.test(contentType);
			// Cleanup files
			try {
				stream.destroy();
				fs.unlinkSync(tarPath);
				fs.unlinkSync(texPath);
				fs.rmdirSync(tmp);
			} catch {}

			if (resp.ok && (isPdfType || isPdfHeader)) {
				return new NextResponse(Buffer.from(buf), {
					status: 200,
					headers: {
						"Content-Type": "application/pdf",
						"Cache-Control": "no-cache",
					},
				});
			}

			const msg =
				isPdfType || isPdfHeader
					? "unexpected non-ok while PDF-like"
					: await safeText(buf);
			tried.push({ engine: "tar-bz2", status: resp.status, error: msg });

			return NextResponse.json(
				{ error: `${hint}Compilation failed across engines.`, tried },
				{ status: 502 }
			);
		} catch (e: any) {
			// If tar fallback failed, return aggregated errors
			tried.push({ engine: "tar-bz2", error: e?.message || String(e) });
			return NextResponse.json(
				{ error: `${hint}Compilation failed across engines.`, tried },
				{ status: 502 }
			);
		}
	} catch (e: any) {
		return new NextResponse(e?.message || "Internal error", { status: 500 });
	}
}

async function safeText(buf: ArrayBuffer): Promise<string> {
	try {
		return new TextDecoder("utf-8", { fatal: false })
			.decode(new Uint8Array(buf))
			.slice(0, 8_000);
	} catch {
		return "";
	}
}
