import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Protect non-API pages: require either a valid session cookie (Google OAuth) or Basic Auth when configured.
const USER = process.env.BASIC_AUTH_USER;
const PASS = process.env.BASIC_AUTH_PASS;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "g_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "";

// Edge-friendly verifier: supports unsigned base64 payloads (dev) and
// HMAC-SHA256-signed cookies when SESSION_SECRET is provided. Uses Web
// Crypto (crypto.subtle) where available so this works in Next middleware.
async function verifySessionCookie(cookie?: string) {
	if (!cookie) return false;
	try {
		const parts = cookie.split(".");
		const b64 = parts[0];
		const sig = parts.length > 1 ? parts[1] : undefined;
		if (!b64) return false;

		// Decode base64 payload to JSON string. Try Buffer (Node) first, then atob/TextDecoder.
		let payloadJson: string;
		try {
			// @ts-ignore - Buffer may be available in some runtimes
			if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
				// Node environment
				// @ts-ignore
				payloadJson = Buffer.from(b64, "base64").toString("utf8");
			} else if (typeof atob === "function") {
				// Browser/Edge runtime
				payloadJson = atob(b64);
			} else {
				// Fallback using TextDecoder
				const binary = atob(b64);
				const bytes = new Uint8Array(binary.length);
				for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
				payloadJson = new TextDecoder().decode(bytes);
			}
		} catch (e) {
			console.error("Failed to decode session cookie base64", e);
			return false;
		}

		// If a secret is configured, verify HMAC-SHA256 signature using Web Crypto
		if (SESSION_SECRET) {
			if (!sig) return false;
			try {
				const enc = new TextEncoder();
				const key = await crypto.subtle.importKey(
					"raw",
					enc.encode(SESSION_SECRET),
					{ name: "HMAC", hash: "SHA-256" },
					false,
					["sign"]
				);
				const signature = await crypto.subtle.sign("HMAC", key, enc.encode(b64));
				const expected = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
				if (expected !== sig) return false;
			} catch (e) {
				console.error("Failed to verify session cookie signature", e);
				return false;
			}
		}

		const payload = JSON.parse(payloadJson);
		if (!payload || typeof payload !== "object") return false;
		if (payload.exp && Date.now() > payload.exp) return false;
		return true;
	} catch (e) {
		console.error("verifySessionCookie unexpected error", e);
		return false;
	}
}

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Allow API, Next internals, static assets and files to pass through
	if (
		pathname.startsWith("/api") ||
		pathname.startsWith("/_next") ||
		pathname.startsWith("/static") ||
		pathname === "/favicon.ico"
	) {
		return NextResponse.next();
	}

	// If a valid session cookie exists, allow. Await the verifier which works
	// in both Edge and Node runtimes (uses Web Crypto where available).
	const cookie = req.cookies.get(SESSION_COOKIE)?.value;
	if (cookie && await verifySessionCookie(cookie)) return NextResponse.next();

	// If Basic auth is configured, allow with Basic credentials
	if (USER && PASS) {
		const auth = req.headers.get("authorization") || "";
		if (auth.startsWith("Basic ")) {
			try {
				const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
				const [u, p] = decoded.split(":");
				if (u === USER && p === PASS) return NextResponse.next();
			} catch (e) {}
		}
		return new NextResponse("Authentication required", {
			status: 401,
			headers: { "WWW-Authenticate": 'Basic realm="Protected"' },
		});
	}

	// Otherwise redirect to Google OAuth start
	const startUrl = new URL("/api/auth/google/start", req.url);
	return NextResponse.redirect(startUrl);
}

export const config = {
	matcher: ["/((?!api|_next|static|favicon.ico).*)"],
};
