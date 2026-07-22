"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { fetchJson } from "@/lib/fetchJson";

export default function NewProjectPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"github" | "zip">("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let projectId: string;

      if (mode === "github") {
        const data = await fetchJson("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl, name }),
        });
        projectId = data.project.id;
      } else {
        if (!file) throw new Error("Please choose a .zip file");
        const form = new FormData();
        form.append("file", file);
        form.append("name", name);
        const data = await fetchJson("/api/projects", { method: "POST", body: form });
        projectId = data.project.id;
      }

      // Kick off analysis
      await fetch(`/api/projects/${projectId}/analyze`, { method: "POST" });
      router.push(`/dashboard/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Analyze a new project</h1>
        <p className="text-slate-500 text-sm mb-8">Give Prodocu a GitHub repo link or upload a zip of your codebase.</p>

        <div className="flex gap-2 mb-6">
          <button
            type="button" onClick={() => setMode("github")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${mode === "github" ? "bg-brand-500 text-white border-brand-500" : "bg-white text-slate-600 border-slate-200"}`}
          >
            GitHub link
          </button>
          <button
            type="button" onClick={() => setMode("zip")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${mode === "zip" ? "bg-brand-500 text-white border-brand-500" : "bg-white text-slate-600 border-slate-200"}`}
          >
            Upload zip
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-100">
          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</div>}

          <label className="block text-sm font-medium text-slate-700 mb-1">Project name (optional)</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-detected if left blank"
            className="w-full mb-4 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
          />

          {mode === "github" ? (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-1">GitHub repository URL</label>
              <input
                required value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full mb-2 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <p className="text-xs text-slate-400 mb-6">Must be a public repository.</p>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project zip file</label>
              <input
                required type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full mb-6 text-sm"
              />
            </>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition disabled:opacity-60"
          >
            {loading ? "Starting analysis…" : "Analyze project"}
          </button>
        </form>
      </main>
    </div>
  );
}
