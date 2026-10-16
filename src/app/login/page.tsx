"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputClass } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fresh install: send the owner to setup instead of a login that cannot work yet.
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((d) => d.needsSetup && router.replace("/setup"))
      .catch(() => undefined);
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="auth">
      <div className="auth-wrap">
        <div className="auth-intro">
          <div className="kicker">Staff back office</div>
          <h1>Welcome back</h1>
          <p>Manage cars & bikes, leads and deals, the online shop, public ads, stock and accounts.</p>
        </div>
        <form className="auth-card" onSubmit={onSubmit}>
          <h2>Sign in</h2>
          <div className="sub">Staff accounts only. Buyers and sellers use <Link href="/account">My Account</Link>.</div>
          {error ? <div className="alert err">{error}</div> : null}
          <div className="stack">
            <Field label="Email" required>
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            <Field label="Password" required>
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </Field>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-dark w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
          </div>
          <div className="auth-foot"><Link href="/">← Back to website</Link></div>
        </form>
      </div>
    </div>
  );
}
