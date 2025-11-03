import { ApiError, GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
// Simple rate limiter for tailoring endpoint
const TAILOR_RATE_WINDOW_MS = 60_000;
const TAILOR_RATE_MAX = 20;
const tailorRate = new Map<string, { count: number; resetAt: number }>();

type Body = {
	jd?: string;
	apiKey?: string;
	baseTex?: string;
	model?: string;
};

export async function POST(req: Request) {
	try {
		const {
			jd,
			apiKey,
			baseTex,
			model: requestedModel,
		}: Body = await req.json();
		// basic rate limiting per IP
		const ip =
			(req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
			"unknown";
		const now = Date.now();
		const ent = tailorRate.get(ip) || {
			count: 0,
			resetAt: now + TAILOR_RATE_WINDOW_MS,
		};
		if (now > ent.resetAt) {
			ent.count = 0;
			ent.resetAt = now + TAILOR_RATE_WINDOW_MS;
		}
		ent.count++;
		tailorRate.set(ip, ent);
		if (ent.count > TAILOR_RATE_MAX) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}
		if (!jd || jd.trim().length < 16) {
			return NextResponse.json(
				{ error: "JD is required and should be at least 16 characters" },
				{ status: 400 }
			);
		}

		const key = apiKey || process.env.GEMINI_API_KEY;
		if (!key) {
			return NextResponse.json(
				{ error: "Missing GEMINI_API_KEY (set env or pass apiKey)" },
				{ status: 400 }
			);
		}

		let base = baseTex;
		if (!base) {
			const filePath = path.join(process.cwd(), "public", "base.tex");
			base = await fs.readFile(filePath, "utf8");
		}
		const experienceContext = `HEalthtrip
    Contributed to the design, development, and deployment of a large-scale SaaS healthcare platform serving 10,000+ daily active users across multiple countries. Focused on backend scalability, cloud infrastructure, and DevOps automation to enhance performance, reliability, and maintainability.

    Migrated 50% of a legacy PHP monolith into modular NestJS microservices, improving scalability and deployment reliability by ~75%.
    Designed and implemented RESTful and GraphQL APIs, improving API throughput by 40% and supporting third-party integrations.
    Architected API gateway (Kong) for controlled partner access and JWT-based authentication, ensuring secure, rate-limited API consumption.
    Applied system design and API architecture best practices to build scalable, fault-tolerant services with redundancy and load balancing.
    Integrated Kafka-based message queues for asynchronous event handling and inter-service communication.
    Performed database optimization (SQL indexing, query tuning), reducing query latency by 70% and supporting 2x concurrent user load.
    Implemented caching strategies (Redis in-memory and distributed cache), reducing data retrieval times by 90%.

    Designed and deployed a full CI/CD pipeline using Jenkins and GitHub Actions, automating build, test, and deployment workflows.
    Reduced deployment time from 3 hours → 10 minutes and improved release frequency from monthly → daily.
    Containerized all backend services using Docker Compose and deployed them on a Kubernetes cluster for scalability and fault tolerance.
    Implemented Infrastructure as Code (IaC) principles for automated provisioning of AWS resources.
    Configured load balancing, auto-scaling, and service discovery within Kubernetes, maintaining 99.9% uptime during peak load.
    Established logging, monitoring, and observability pipelines with CloudWatch and Prometheus/Grafana dashboards.
    Managed incident response and fault recovery, defining SLOs/SLIs and automated alert systems for early failure detection.

    Managed and optimized 20+ AWS EC2 instances, S3 buckets, and CloudFront distributions integrated with Cloudflare CDN and WAF.
    Deployed rate limiting, SSL/TLS encryption, and DDoS prevention mechanisms for secure content delivery.
    Applied OWASP best practices, secure coding standards, and data encryption at rest and in transit.
    Implemented secrets management using AWS KMS and environment variables for secure credential handling.
    Reduced global page load times by 50% and improved uptime by 30% through optimized caching and CDN rules.

    Built an internal translation management dashboard using Next.js and REST APIs, handling 1,000+ daily translation entries.
    Reduced manual editing time by 50%, improved data consistency, and optimized UI load performance by 35%.
    Used React Hooks, Context API, and responsive design principles for cross-browser compatibility and accessibility.

    Participated in Agile development sprints, Scrum ceremonies, and code reviews, collaborating in a cross-functional team of 6 engineers.
    Led stakeholder communication as the main developer on key backend services despite being an intern.
    Created detailed technical documentation, API specs, and system design diagrams for internal teams and onboarding.
    Contributed to knowledge sharing and mentorship, helping new developers onboard faster and align with system architecture.

    Tech Stack

    Node.js, NestJS, Express, TypeScript, JavaScript, Next.js, React, Redis, Elasticsearch, PostgreSQL, MongoDB, AWS (EC2, S3, CloudFront, IAM, CloudWatch, KMS), Cloudflare, Docker, Docker Compose, Kubernetes, Jenkins, GitHub Actions, REST APIs, GraphQL, Kong API Gateway, JWT Auth, Kafka, CI/CD, IaC, Load Balancing, Auto-scaling, Monitoring, SLOs/SLIs, OWASP, Secure Coding, Agile/Scrum, Jest, Postman, Documentation.




    AST Consulting

    Contributed to the design and deployment of a SaaS analytics and automation platform serving thousands of users globally. Focused on scalable backend services, cloud infrastructure, CI/CD automation, and system reliability.

    Backend Engineering

    Developed modular NestJS microservices improving maintainability and scalability by 60%.
    Designed RESTful & GraphQL APIs for analytics and automation with 35% higher throughput.
    Used Redis caching and async job queues to cut response latency by 45%.
    Applied clean architecture, API design, and fault-tolerant patterns for reliability.

    Cloud Infrastructure

    Built a CDN with AWS S3, CloudFront, and EC2, reducing image load time by 50% and latency by 40%.
    Automated provisioning with Infrastructure as Code, enabling faster scaling.
    Configured SSL/TLS, IAM, and Cloudflare WAF for DDoS prevention and secure access.

    DevOps & CI/CD

    Built CI/CD pipelines (GitHub Actions + Docker), cutting release cycles from hours to minutes.
    Deployed containerized microservices with Docker Compose and Kubernetes for 95%+ uptime.
    Added observability via Prometheus/Grafana and logging for system insights.

    Automation & Integrations

    Built Telegram bot automating workflows for 25% of users.
    Integrated Stripe & Chargebee for payments, automating billing and subscriptions.
    Experimented with OpenAI APIs and internal ML models for content generation and analytics.

    Collaboration & Agile

    Set up structured GitHub code reviews, reducing post-release bugs by 30%.
    Improved feature delivery speed by 20% through sprint planning and CI feedback loops.
    Documented APIs, architecture, and deployment for cross-functional collaboration.

    Tech Stack: NestJS, Node.js, TypeScript, MongoDB, Redis, Docker, Kubernetes, GitHub Actions, AWS (EC2, S3, CloudFront), Cloudflare, Prometheus, Grafana, Stripe, Chargebee, OpenAI API, Telegram Bot, GraphQL, IaC, CI/CD, Agile/Scrum.
    `;
		const prompt = buildPrompt(base!, jd, experienceContext);
		const ai = new GoogleGenAI({ apiKey: key });
		// Only allow valid Gemini text models
		const validModels = [
			requestedModel,
			process.env.GEMINI_MODEL,
			"gemini-1.5-flash-latest",
			"gemini-1.5-flash",
			"gemini-1.5-pro-latest",
			"gemini-1.5-pro",
			"gemini-1.5-flash-8b",
			"gemini-pro",
			"gemini-1.0-pro",
			"gemini-1.0-pro-latest",
			"gemini-2.0-flash-001",
			"gemini-2.0-pro-001",
		].filter(
			(m): m is string =>
				typeof m === "string" &&
				!!m &&
				!m.includes("embedding") &&
				!m.includes("gecko")
		);

		let tex = "";
		let lastErr: unknown;
		// Retry logic for rate limits
		async function generateWithRetry(model: string, maxRetries = 3) {
			for (let i = 0; i < maxRetries; i++) {
				try {
					const resp = await ai.models.generateContent({
						model,
						contents: prompt,
					});
					return resp.text;
				} catch (error) {
					if (error instanceof ApiError) {
						if (error.status === 429) {
							const delay = Math.pow(2, i) * 1000;
							await new Promise((res) => setTimeout(res, delay));
							continue;
						}
						lastErr = error;
						break;
					} else {
						lastErr = error;
						break;
					}
				}
			}
			return "";
		}

		for (const name of validModels) {
			if (typeof name !== "string" || !name) continue;
			tex = (await generateWithRetry(name)) || "";
			if (tex && tex.trim()) break;
		}

		// Fallback: try raw HTTP against v1 endpoint if all SDK attempts fail
		if (!tex || !tex.trim()) {
			try {
				for (const name of validModels) {
					if (!name) continue;
					const raw = await rawGenerateV1(name, prompt, key);
					if (raw && raw.trim()) {
						tex = raw;
						break;
					}
				}
			} catch (e) {
				lastErr = e;
			}
			if (!tex || !tex.trim()) {
				// Log error for debugging, but don't leak sensitive info
				if (lastErr instanceof ApiError) {
					console.error("Gemini API error:", {
						name: lastErr.name,
						status: lastErr.status,
						message: lastErr.message,
					});
				} else {
					console.error(
						"Gemini call failed across models (SDK v1beta + HTTP v1)",
						{ lastErr, validModels }
					);
				}
				return NextResponse.json(
					{
						error: "Gemini API call failed. Try a different model.",
						tried: validModels,
					},
					{ status: 502 }
				);
			}
		}

		// Clean common code fence wrappers if present
		tex = stripCodeFences(tex).trim();

		// Basic sanity: ensure it looks like LaTeX and preserves documentclass
		if (!/\\documentclass/.test(tex)) {
			// fallback: return original base to avoid broken output
			return NextResponse.json({ tex: base }, { status: 200 });
		}

		return NextResponse.json({ tex }, { status: 200 });
	} catch (err: any) {
		// Use NextResponse.json for error responses
		if (err instanceof ApiError) {
			return NextResponse.json(
				{ error: err.message, status: err.status },
				{ status: err.status }
			);
		}
		console.error("/api/tailor error", err);
		return NextResponse.json(
			{ error: err?.message || "Internal error" },
			{ status: 500 }
		);
	}
}

/**
 * Builds a precise prompt for the AI to tailor a LaTeX resume.
 *
 * @param {string} base - The full string content of the current LaTeX resume (.tex file).
 * @param {string} jd - The text of the target job description.
 * @param {string} experienceContext - A narrative/story describing past experiences, projects, and achievements.
 * @returns {string} The complete prompt for the AI.
 */
function buildPrompt(base: string, jd: string, experienceContext: string) {
	return [
		"You are a precise LaTeX resume tailoring assistant. Your task is to rewrite a resume to target a specific job, using a narrative context for the details.",
		"## Task & Inputs Overview",
		"You will be given three inputs:",
		"1.  **Current LaTeX resume (`base`):** This is the .tex file to be edited. You MUST preserve its structure, macros, and preamble.",
		"2.  **Job Description (`jd`):** This is the target. You will use its keywords and requirements as a *filter*.",
		"3.  **Experience Context (`story`):** This is a narrative of past experiences. This is your *source of truth* for accomplishments, metrics, and project details.",
		"## Core Instructions",
		// --- How to use the inputs ---
		"- Use the **Experience Context** as the primary source to understand *what* was done. Extract the most impactful achievements, metrics, and technical details from this story.",
		"- Use the **Job Description** to *select, filter, and prioritize* the details from the Experience Context. If the JD values 'scalability', pull scalability metrics from the story. If it values 'CI/CD', highlight those parts of the story.",
		"- **Modify the content** (text inside `\\resumeItem`, `\\resumeSubheading`, and skill sections) of the **Current LaTeX resume** (`base`) to reflect this filtered and prioritized information.",
		// --- Content & Tone Requirements ---
		"- **Ensure a highly technical tone** suitable for Software Engineer (SDE), DevOps, or SRE roles. Emphasize systems, automation, scalability, and performance.",
		"- Translate the story's achievements into concise, metric-driven bullet points using the XYZ formula (Accomplished X, measured by Y, by doing Z).",
		"- **Bold the most impactful parts** of each bullet — typically the measurable achievements or results (e.g., performance gains, uptime improvements, latency reductions, cost savings). Example: `Improved API throughput by **40%** through caching optimization.`",
		"- **Keyword Optimization:** Naturally integrate keywords from the `jd` into the rewritten bullet points.",
		// --- NEW INSTRUCTION ---
		"- **Use `\\invisible{}` for ATS Optimization:** The LaTeX preamble defines a command `\\invisible{text}` which adds invisible text to the PDF. Use this strategically to embed common variations of keywords for Applicant Tracking Systems (ATS). For example, if the visible text is `React`, you might write it as `React\\invisible{ React.js ReactJS}`. Similarly, if a bullet mentions `AWS`, you could add `\\invisible{ Amazon Web Services}` nearby.",
		"- **Ethical Skill Matching:** If the `base` resume or `story` mentions a tool (e.g., 'Jenkins') and the `jd` requires a similar one (e.g., 'GitLab CI'), update the bullet point to feature 'GitLab CI' *only* if the context from the story supports it (e.g., \"automated CI/CD pipelines\"). Do not invent experience.",
		// --- Strict LaTeX Guardrails ---
		"- **STRICTLY preserve the LaTeX structure,** preamble, custom macros (\\resumeItem, \\resumeSubheading, \\invisible, etc.), sections, and formatting.",
		"- **Do NOT add new packages.** Do NOT remove existing commands/macros.",
		"- Keep the header (name, contacts) and hyperlinks intact.",
		"- **Maintain a 1-page limit.** Prefer rewording and replacing existing bullet points over adding new ones, as the template is tightly constrained. The use of `\\invisible{}` is good as it does not affect visual layout.",
		// --- Output Format ---
		"- **Output ONLY the raw, complete .tex document** (from `\\documentclass...` to `\\end{document}`).",
		"- Do not add any explanations, comments, or markdown code fences (` ``` `).",
		"---",
		"## Job Description (The Filter)",
		jd,
		"---",
		"## Experience Context (The Story / Source of Truth)",
		experienceContext,
		"---",
		"## Current LaTeX resume (The Document to Edit)",
		base,
	].join("\n\n");
}

function stripCodeFences(s: string) {
	// remove leading/trailing code fences if model wraps output
	return s.replace(/^\s*```(?:latex|tex)?\s*/i, "").replace(/\s*```\s*$/i, "");
}

async function rawGenerateV1(
	model: string,
	prompt: string,
	apiKey: string
): Promise<string> {
	const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
		model
	)}:generateContent?key=${encodeURIComponent(apiKey)}`;
	const body = {
		contents: [
			{
				role: "user",
				parts: [{ text: prompt }],
			},
		],
	};
	const resp = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!resp.ok) throw new Error(`v1 generateContent failed ${resp.status}`);
	const json = await resp.json();
	const text =
		json?.candidates?.[0]?.content?.parts
			?.map((p: any) => p?.text)
			.filter(Boolean)
			.join("\n") ||
		json?.candidates?.[0]?.content?.parts?.[0]?.text ||
		"";
	return text as string;
}
