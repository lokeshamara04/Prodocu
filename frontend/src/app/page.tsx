"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) router.push("/dashboard");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-2xl">
        <div className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-6">
          Powered by Prodocu
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-slate-900 mb-4">Prodocu</h1>
        <p className="text-lg text-slate-600 mb-10">
          Drop in a GitHub repo link or a project zip. Prodocu detects your tech stack, maps your
          architecture, draws diagrams, and hands you back polished documentation — as Markdown, PDF, or Word.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/signup" className="px-6 py-3 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition">
            Get started
          </Link>
          <Link href="/signin" className="px-6 py-3 rounded-lg bg-white text-slate-700 font-medium border border-slate-200 hover:border-slate-300 transition">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
