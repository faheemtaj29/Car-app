"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MouseEvent, useEffect, useState } from "react";
import { formatPKRShort } from "@/lib/dealership";
import {
  MAX_COMPARE,
  SAVED_EVENT,
  clearCompare,
  compareList,
  savedList,
  toggleCompare,
  toggleSaved,
  type SavedRef,
} from "./saved";

function useLists() {
  const [saved, setSaved] = useState<SavedRef[]>([]);
  const [compare, setCompare] = useState<SavedRef[]>([]);
  useEffect(() => {
    const sync = () => {
      setSaved(savedList());
      setCompare(compareList());
    };
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { saved, compare };
}

/** ♥ and ⇄ toggles. Safe inside a card link: clicks do not navigate. */
export function SaveCompareButtons({ id, type, variant = "card" }: { id: string; type: "car" | "bike"; variant?: "card" | "detail" }) {
  const { saved, compare } = useLists();
  const [full, setFull] = useState(false);
  const isSaved = saved.some((r) => r.id === id);
  const inCompare = compare.some((r) => r.id === id);

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div className={`mk-save ${variant}`}>
      <button
        type="button"
        className={isSaved ? "on" : ""}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Remove from saved" : "Save"}
        title={isSaved ? "Saved" : "Save"}
        onClick={(e) => {
          stop(e);
          toggleSaved({ id, type });
        }}
      >
        {isSaved ? "♥" : "♡"}
        {variant === "detail" ? <span>{isSaved ? " Saved" : " Save"}</span> : null}
      </button>
      <button
        type="button"
        className={inCompare ? "on" : ""}
        aria-pressed={inCompare}
        title={full ? `Compare up to ${MAX_COMPARE}` : inCompare ? "Remove from compare" : "Add to compare"}
        onClick={(e) => {
          stop(e);
          const ok = toggleCompare({ id, type });
          setFull(!ok);
          if (!ok) setTimeout(() => setFull(false), 2000);
        }}
      >
        ⇄{variant === "detail" ? <span>{inCompare ? " In compare" : " Compare"}</span> : null}
      </button>
      {full ? <span className="mk-save-hint">Max {MAX_COMPARE}</span> : null}
    </div>
  );
}

/** Floating bar once 1+ vehicles are picked for comparison. */
export function CompareTray() {
  const { compare } = useLists();
  const pathname = usePathname();
  if (!compare.length || pathname === "/compare") return null;
  return (
    <div className="mk-tray" role="region" aria-label="Compare">
      <span>
        <b>{compare.length}</b> of {MAX_COMPARE} selected to compare
      </span>
      <Link href={`/compare?ids=${compare.map((c) => c.id).join(",")}`} className="site-btn">
        Compare now
      </Link>
      <button type="button" className="mk-link" onClick={clearCompare}>
        Clear
      </button>
    </div>
  );
}

type Listing = {
  _id: string; vehicleType: "car" | "bike"; title: string; price: number; photos: string[];
  mileage: number; year: number; city?: string; seller: { type: string };
};

export function SavedPage() {
  const { saved } = useLists();
  const [rows, setRows] = useState<Listing[] | null>(null);
  const key = saved.map((s) => s.id).join(",");

  useEffect(() => {
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows([]);
      return;
    }
    let live = true;
    fetch(`/api/site/cars/batch?ids=${key}`)
      .then((r) => r.json())
      .then((d) => live && setRows(d.listings || []))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [key]);

  if (rows === null) return <p className="mk-muted">Loading…</p>;
  const gone = saved.filter((s) => !rows.some((r) => r._id === s.id));
  return (
    <>
      {!rows.length ? (
        <div className="site-card">
          <h3>Nothing saved yet</h3>
          <p>Tap ♡ on any car or bike to keep it here. <Link href="/cars" className="site-link">Browse cars →</Link></p>
        </div>
      ) : (
        <div className="mk-grid">
          {rows.map((c) => (
            <Link key={c._id} href={`/${c.vehicleType === "bike" ? "bikes" : "cars"}/${c._id}`} className="mk-card">
              <div className="mk-card-photo" style={c.photos[0] ? { backgroundImage: `url("${c.photos[0]}")` } : undefined}>
                <SaveCompareButtons id={c._id} type={c.vehicleType} />
              </div>
              <div className="mk-card-body">
                <div className="mk-card-title">{c.title}</div>
                <div className="mk-card-price">{formatPKRShort(c.price)}</div>
                <div className="mk-card-specs"><span>{c.year}</span><span>{c.mileage.toLocaleString()} km</span><span>{c.city || ""}</span></div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {gone.length ? (
        <p className="mk-muted" style={{ marginTop: 12 }}>
          {gone.length} saved {gone.length === 1 ? "vehicle is" : "vehicles are"} no longer listed (sold or removed).{" "}
          <button type="button" className="mk-link" onClick={() => gone.forEach((g) => toggleSaved(g))}>Remove</button>
        </p>
      ) : null}
    </>
  );
}
