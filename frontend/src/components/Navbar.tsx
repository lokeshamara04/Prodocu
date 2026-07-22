"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
}

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-100 bg-white">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold text-lg text-slate-900">
          Prodocu
        </Link>
        <div className="flex items-center gap-4">
          {!loading && user && <span className="text-sm text-slate-500">{user.name || user.email}</span>}
          {!loading && user && (
            <button
              onClick={handleSignOut}
              className="text-sm text-slate-500 hover:text-slate-800 transition"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
