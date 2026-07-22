"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import StatusBadge from "@/components/StatusBadge";
import { fetchJson } from "@/lib/fetchJson";

interface ProjectSummary {
  id: string; name: string; sourceType: string; sourceRef: string;
  status: string; errorMessage: string | null; createdAt: string; updatedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // First check auth
    fetchJson("/api/auth/me")
      .then((data) => {
        if (!data.user) {
          router.push("/signin");
          return;
        }
        setAuthChecked(true);
        // Then fetch projects
        return fetchJson("/api/projects");
      })
      .then((data) => {
        if (data?.projects) setProjects(data.projects);
      })
      .catch(() => router.push("/signin"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="max-w-5xl mx-auto px-6 py-10 text-slate-500">Loading…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Your projects</h1>
          <Link href="/dashboard/new" className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition">
            + New project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-200 rounded-xl">
            <p className="text-slate-500 mb-4">No projects yet.</p>
            <Link href="/dashboard/new" className="text-brand-600 font-medium">Analyze your first project →</Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <Link
                key={p.id} href={`/dashboard/${p.id}`}
                className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-5 py-4 hover:border-brand-300 transition"
              >
                <div>
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-sm text-slate-500">
                    {p.sourceType === "github" ? "GitHub" : "Zip upload"} · {p.sourceRef}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
