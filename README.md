# Tailor CV (Next.js + Gemini)

A small web app to tailor your LaTeX CV to a job description using Google Gemini.

- Backend: Next.js App Router API
- Frontend: Simple React page
- Output: Tailored `.tex` you can copy or download

## Setup

1. Install dependencies
2. Create an `.env.local` with your Gemini key (or paste it in the UI)

```bash
npm install
cp .env.local.example .env.local # optional
```

In `.env.local`:

```
GEMINI_API_KEY=your_key_here
# Optional: override default model
# GEMINI_MODEL=gemini-1.5-pro-latest
```

## Run locally

```bash
npm run dev
```

Open http://localhost:3000 and paste a JD. Optionally provide a Gemini key in the field if not set in env.

## Deploy on Vercel

- Root directory: `tailor-cv`
- Framework preset: Next.js
- Build command: `npm run build`
- Output directory: `.next`
- Environment variable: `GEMINI_API_KEY`

After deploy, visit your Vercel URL.

## Notes

- The app ships with `public/base.tex` copied from your current resume.
- The API enforces: preserve LaTeX macros and structure, avoid adding packages, output raw `.tex` only.
- If the model responds without `\\documentclass`, the API will safely fall back to the original base.