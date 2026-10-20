"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type NavLink = { href: string; label: string };

export function MobileNav({ nav, name }: { nav: NavLink[]; name: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("keydown", (e) => e.key === "Escape" && close());
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  // Close on route change (link click)
  function handleLink() { setOpen(false); }

  return (
    <>
      <button
        className="mob-nav-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mob-nav-drawer"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`mob-nav-bar mob-nav-bar-1${open ? " open" : ""}`} />
        <span className={`mob-nav-bar mob-nav-bar-2${open ? " open" : ""}`} />
        <span className={`mob-nav-bar mob-nav-bar-3${open ? " open" : ""}`} />
      </button>

      {open && <div className="mob-nav-backdrop" onClick={() => setOpen(false)} aria-hidden />}

      <nav id="mob-nav-drawer" className={`mob-nav-drawer${open ? " open" : ""}`} aria-label="Main menu">
        <div className="mob-nav-head">
          <span className="mob-nav-title">{name}</span>
          <button className="mob-nav-close" aria-label="Close menu" onClick={() => setOpen(false)}>✕</button>
        </div>
        {nav.map((l) => (
          <Link key={l.href} href={l.href} className="mob-nav-item" onClick={handleLink}>
            {l.label}
          </Link>
        ))}
        <div className="mob-nav-divider" />
        <Link href="/account" className="mob-nav-item" onClick={handleLink}>Account</Link>
        <Link href="/saved" className="mob-nav-item" onClick={handleLink}>Saved Vehicles</Link>
        <Link href="/post-ad" className="mob-nav-cta" onClick={handleLink}>Post Free Ad</Link>
      </nav>
    </>
  );
}
