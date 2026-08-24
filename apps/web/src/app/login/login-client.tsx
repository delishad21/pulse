"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";

export function LoginClient({ registrationEnabled }: { registrationEnabled: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    const result = await signIn("credentials", { username, password, redirect: false });
    if (result?.error) { setError("Invalid username or password."); setLoading(false); return; }
    const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl") || "/inbox";
    router.push(callbackUrl); router.refresh();
  }

  return <main className="relative flex min-h-screen items-center justify-center bg-canvas p-5">
    <div className="absolute right-5 top-5"><ThemeToggle compact /></div>
    <div className="w-full max-w-[420px]">
      <div className="mb-8 flex justify-center"><div className="flex items-center gap-3"><Image src="/pulse-waveform-logo.png" alt="Pulse" width={62} height={51} priority className="h-[51px] w-[62px] object-contain" /><div><div className="text-2xl font-extrabold tracking-tight text-ink">Pulse</div><div className="text-xs font-medium text-muted">Tasks, everywhere.</div></div></div></div>
      <section className="rounded-2xl border border-stroke bg-surface p-7 shadow-float sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1><p className="mt-1 text-sm text-muted">Sign in to your task workspace.</p>
        {error ? <div className="mt-5 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">{error}</div> : null}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink">Username</span><input type="text" autoComplete="username" required value={username} onChange={(e)=>setUsername(e.target.value)} className="h-11 w-full rounded-lg border border-stroke bg-surface-subtle px-3 text-sm text-ink outline-none transition focus:border-primary" placeholder="delishad21" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink">Password</span><input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e)=>setPassword(e.target.value)} className="h-11 w-full rounded-lg border border-stroke bg-surface-subtle px-3 text-sm text-ink outline-none transition focus:border-primary" placeholder="Your password" /></label>
          <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"><LogIn className="size-4" />{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        {registrationEnabled ? <p className="mt-6 text-center text-sm text-muted">Need an account? <Link href="/register" className="font-semibold text-primary hover:underline">Register</Link></p> : null}
      </section>
    </div>
  </main>;
}
