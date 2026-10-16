"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputClass } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ businessName: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((d) => (d.needsSetup === false ? router.replace("/login") : setChecking(false)))
      .catch(() => setChecking(false));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Setup failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  if (checking) return <div className="auth">Loading…</div>;

  return (
    <div className="auth">
      <div className="auth-wrap">
        <div className="auth-intro">
          <div className="kicker">First-time setup</div>
          <h1>Set up your dealership</h1>
          <p>Name your business and create the owner account. This screen only works while there are no users yet.</p>
        </div>
        <form className="auth-card" onSubmit={onSubmit}>
          <h2>Business & owner</h2>
          <div className="sub">You can add showroom staff later in Settings.</div>
          {error ? <div className="alert err">{error}</div> : null}
          <div className="stack">
            <Field label="Business name" required>
              <input className={inputClass} value={form.businessName} onChange={(e) => set("businessName", e.target.value)} placeholder="e.g. Taj Motors" required />
            </Field>
            <Field label="Your name" required>
              <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </Field>
            <Field label="Email" required>
              <input className={inputClass} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required autoComplete="email" />
            </Field>
            <Field label="Password" required>
              <input className={inputClass} type="password" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={8} placeholder="At least 8 characters" required autoComplete="new-password" />
            </Field>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-dark w-full" disabled={loading}>{loading ? "Creating…" : "Create & open dashboard"}</button>
          </div>
          <div className="auth-foot">Already set up? <Link href="/login">Sign in</Link></div>
        </form>
      </div>
    </div>
  );
}
