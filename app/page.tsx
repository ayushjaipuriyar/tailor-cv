"use client";
import { Button } from "@/components/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/components/ui/card";
import { Label } from "@/components/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/components/ui/tabs";
import { useEffect, useState } from "react";

export default function Page() {
  // Handler stubs to prevent errors
  const onTailor = async () => {
    setLoading(true);
    setError("");
    try {
      // 1) Send JD + baseTex to server AI tailoring endpoint
      const tailorResp = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd, baseTex }),
      });
      if (!tailorResp.ok) {
        const errText = await tailorResp.text();
        setError(`Tailoring failed: ${errText}`);
        return;
      }
      const tailorJson = await tailorResp.json();
      const tailoredTex = (tailorJson?.tex as string) || "";
      if (!tailoredTex) {
        setError("Tailoring returned no LaTeX content");
        return;
      }

      // Update editor with tailored LaTeX
      setResult(tailoredTex);

      // 2) Send tailored TeX to server-side uploader which builds tar.bz2 and forwards to latexonline
      const texBlob = new Blob([tailoredTex], { type: "text/x-tex" });
      const form = new FormData();
      form.append("file", texBlob, "main.tex");

      const res = await fetch("/api/compile/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        setError(
          `Compilation failed.` + (text ? `\nLaTeX log:\n${text}` : "")
        );
        return;
      }
      const pdfBlob = await res.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      // revoke previous preview URL to avoid leaking memory and avoid stale caching
      try {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      } catch {}
      setPreviewUrl(pdfUrl);
  setLastPreviewContent(tailoredTex);
  setActiveTab("pdf");
    } catch (err: any) {
      setError(err?.message || "Failed to generate PDF preview.");
    } finally {
      setLoading(false);
    }
  };
  const onCopy = () => {};
  const onDownload = () => {};
  const onCreateTar = async () => {
    setError("");
    setCompiling(true);
    try {
      const texContent = result || baseTex;
      const blob = new Blob([texContent], { type: "text/x-tex" });
      const form = new FormData();
      form.append("file", blob, "main.tex");

      const res = await fetch("/api/compile/upload?onlyArchive=1", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`Failed to create tarball: ${txt}`);
        return;
      }
      const fileBuf = await res.blob();
      const url = URL.createObjectURL(fileBuf);
      // revoke previous if present
      if (tarBlobUrl) URL.revokeObjectURL(tarBlobUrl);
      setTarBlobUrl(url);
    } catch (e: any) {
      setError(e?.message || "Failed to create tarball");
    } finally {
      setCompiling(false);
    }
  };
  const [jd, setJd] = useState("");
  const [baseTex, setBaseTex] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>('latex');
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [lastPreviewContent, setLastPreviewContent] = useState<string>("");

  // Revoke previewUrl on unmount or when it changes to avoid leaking blob URLs
  useEffect(() => {
    return () => {
      try {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      } catch {}
    };
    // only run cleanup when previewUrl changes or on unmount
  }, [previewUrl]);

  useEffect(() => {
    fetch("/base.tex")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("Failed to load base.tex"))))
      .then(setBaseTex)
      .catch(() => {});
  }, []);

  // ...existing logic for previewUrl effect and handlers...

  // Download link logic (hydration-safe)
  const [downloadUrl, setDownloadUrl] = useState<string>("#");
  const [tarBlobUrl, setTarBlobUrl] = useState<string>("");
  useEffect(() => {
    // If the LaTeX content changes, clear any previously generated tarball
    if (tarBlobUrl) {
      try {
        URL.revokeObjectURL(tarBlobUrl);
      } catch {}
      setTarBlobUrl("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, baseTex]);
  useEffect(() => {
    if (activeTab === "latex") {
      const blob = new Blob([result || baseTex], { type: "text/x-tex" });
      setDownloadUrl(URL.createObjectURL(blob));
      return () => {
        URL.revokeObjectURL(downloadUrl);
      };
    } else if (activeTab === "pdf" && previewUrl) {
      setDownloadUrl(previewUrl);
    } else {
      setDownloadUrl("#");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, result, baseTex, previewUrl]);

  const compilePreview = async () => {
    setError("");
    setCompiling(true);
    try {
      const texContent = result || baseTex;
      // If nothing changed since last preview, skip compile
      if (!texContent) throw new Error("No LaTeX content to compile");
      const form = new FormData();
      form.append("file", new Blob([texContent], { type: "text/x-tex" }), "main.tex");

      const res = await fetch("/api/compile/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        setError(`Compilation failed.` + (text ? `\nLaTeX log:\n${text}` : ""));
        return false;
      }
      const pdfBlob = await res.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      try {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      } catch {}
      setPreviewUrl(pdfUrl);
      setLastPreviewContent(texContent);
      return true;
    } catch (err: any) {
      setError(err?.message || "Failed to generate PDF preview.");
      return false;
    } finally {
      setCompiling(false);
    }
  };
  // When switching to PDF tab, compile only if content changed since last preview
  const onTabChange = async (val: string) => {
    setActiveTab(val);
    if (val === "pdf") {
      const texContent = result || baseTex;
      if (!texContent) {
        setError("No LaTeX content available to preview.");
        return;
      }
      if (previewUrl && lastPreviewContent === texContent) {
        // nothing changed, reuse previewUrl
        return;
      }
      await compilePreview();
    }
  };
  return (
    <main className="min-h-screen bg-neutral-900 text-neutral-100 p-4 sm:p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-2 text-blue-400 drop-shadow">Tailor your CV</h1>
        <p className="text-neutral-400 mb-4 text-lg font-medium">Paste your job description below. Your tailored LaTeX resume will be generated using Gemini AI.</p>
      </div>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">
        {/* Left: JD input */}
        <div className="w-full">
          <Card className="bg-neutral-800 border border-neutral-700 shadow-lg">
            <CardHeader>
              <CardTitle className="text-neutral-100">Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="jd-input" className="text-neutral-300">Paste your job description</Label>
              <textarea
                id="jd-input"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste job description here..."
                rows={12}
                className="w-full font-mono text-base bg-neutral-900 border border-neutral-700 rounded-lg p-3 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none min-h-[220px] md:min-h-[320px] shadow-sm text-neutral-100 placeholder:text-neutral-500"
              />
              <div className="flex flex-col md:flex-row gap-3 mt-4 flex-wrap">
                <Button onClick={onTailor} disabled={loading || !jd} variant="default" className="w-full md:w-auto transition transform duration-200 ease-out hover:scale-[1.03] hover:bg-blue-700">
                  {loading ? "Tailoring..." : "Tailor CV"}
                </Button>
                <Button onClick={onCopy} disabled={!result} variant="outline" className="w-full md:w-auto transition-colors duration-150 hover:bg-neutral-700/40">Copy .tex</Button>
                {/* Create tarball on demand and provide download link once ready */}
                <div className="w-full md:w-auto">
                  {!tarBlobUrl ? (
                     <Button onClick={onCreateTar} variant="ghost" className="w-full transition-colors duration-150 hover:bg-neutral-700/30">
                      Create & Download tarball
                    </Button>
                  ) : (
                    <a href={tarBlobUrl} download="archive.tar.bz2" className="w-full block">
                       <Button variant="ghost" className="w-full transition-colors duration-150 hover:bg-neutral-700/30">Download tarball</Button>
                    </a>
                  )}
                </div>
              </div>
              {error && (
                <Card className="bg-red-900/30 border-red-700 mt-4">
                  <CardContent>
                    <span className="text-red-400 font-semibold">{error}</span>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
        {/* Right: Tabs for LaTeX and PDF preview, with download button in tab bar */}
        <div className="w-full">
          <Card className="bg-neutral-800 border border-neutral-700 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-neutral-700 bg-neutral-900 rounded-t-xl p-3">
              <Tabs defaultValue={activeTab} onValueChange={onTabChange} className="w-full">
                <TabsList className="flex gap-2 bg-neutral-900">
                  <TabsTrigger value="latex" className="text-neutral-100 transition-colors duration-150 hover:text-blue-300">LaTeX</TabsTrigger>
                  <TabsTrigger value="pdf" className="text-neutral-100 transition-colors duration-150 hover:text-blue-300">PDF Preview</TabsTrigger>
                </TabsList>
              </Tabs>
              <a
                href={downloadUrl}
                download={activeTab === "latex" ? "resume.tex" : "resume.pdf"}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-0 sm:ml-auto mr-0 sm:mr-4 w-full sm:w-auto"
              >
                <Button variant="secondary" size="sm" disabled={activeTab === "pdf" && !previewUrl} className="w-full sm:w-auto bg-blue-900 text-blue-200 border-blue-700 hover:bg-blue-800 transition-colors duration-150">
                  Download {activeTab === "latex" ? ".tex" : "PDF"}
                </Button>
              </a>
            </div>
            <div className="p-0">
              {activeTab === "latex" ? (
                <div className="p-3">
                  <textarea
                    value={result || baseTex}
                    onChange={(e) => setResult(e.target.value)}
                    placeholder="Tailored .tex will appear here..."
                    rows={14}
                    className="w-full font-mono text-sm bg-neutral-900 border border-neutral-700 rounded-lg p-3 min-h-[220px] md:min-h-[320px] focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none shadow-sm text-neutral-100 placeholder:text-neutral-500"
                  />
                </div>
              ) : (
                <div className="p-3">
                  {previewUrl ? (
                    <iframe
                      src={previewUrl}
                      className="w-full h-[48vh] md:h-[600px] border rounded bg-neutral-900 text-neutral-100"
                    />
                  ) : (
                    <div className="text-neutral-400 mt-6">Preview will appear here once compiled.</div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
      {(loading || compiling) && (
        <div className="fixed inset-0 bg-neutral-900/85 flex items-center justify-center z-50">
          <Card className="bg-neutral-800 rounded-xl p-8 shadow-xl min-w-[240px] text-center border border-neutral-700">
            <CardTitle className="mb-2 text-neutral-100">{loading ? "Tailoring" : "Compiling PDF"}</CardTitle>
            <CardDescription className="text-neutral-400">Please wait...</CardDescription>
          </Card>
        </div>
      )}
    </main>
  );
}

