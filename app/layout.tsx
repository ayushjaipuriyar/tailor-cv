import React from "react";
import './globals.css'
export const metadata = {
  title: "Tailor CV",
  description: "Tailor your LaTeX CV to a job description with Gemini",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen font-sans w-full h-full px-0 py-0">
        {children}
      </body>
    </html>
  );
}

