"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheckBig, UserPlus } from "lucide-react";
import { signIn } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";

export function RegisterClient() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    const response = await fetch("/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Registration failed."); setLoading(false); return; }
    const result = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    if (result?.error) { setError("Account created, but automatic sign-in failed."); setLoading(false); return; }
    router.push("/inbox"); router.refresh();
  }
  return <main className="relative flex min-h-screen items-center justify-center bg-canvas p-5">
    <div className="absolute right-5 top-5"><ThemeToggle compact /></div>
    <div className="w-full max-w-[420px]">
      <div className="mb-8 flex justify-center"><div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-xl bg-primary text-white shadow-sm"><CircleCheckBig className="size-7" /></div><div><div className="text-2xl font-extrabold tracking-tight text-ink">Pulse</div><div className="text-xs font-medium text-muted">Create your workspace</div></div></div></div>
      <section className="rounded-2xl border border-stroke bg-surface p-7 shadow-float sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Create account</h1><p className="mt-1 text-sm text-muted">Your tasks stay isolated to your account.</p>
        {error ? <div className="mt-5 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">{error}</div> : null}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink">Name</span><input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="h-11 w-full rounded-lg border border-stroke bg-surface-subtle px-3 text-sm text-ink outline-none focus:border-primary" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink">Email</span><input type="email" required autoComplete="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} className="h-11 w-full rounded-lg border border-stroke bg-surface-subtle px-3 text-sm text-ink outline-none focus:border-primary" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink">Password</span><input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} className="h-11 w-full rounded-lg border border-stroke bg-surface-subtle px-3 text-sm text-ink outline-none focus:border-primary" /><span className="mt-1 block text-xs text-muted">At least 8 characters.</span></label>
          <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"><UserPlus className="size-4" />{loading ? "Creating…" : "Create account"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
      </section>
    </div>
  </main>;
}
