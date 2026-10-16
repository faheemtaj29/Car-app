"use client";

import { useEffect, useState } from "react";
import type { PublicListing } from "@/backend/services/marketplace.service";
import { ListingCard } from "./Listing";

const RECENT_KEY = "am_recent_v1";
const MAX_RECENT = 12;

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** Put on a listing page: remembers it for "Recently viewed". */
export function TrackView({ id }: { id: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, MAX_RECENT)));
    } catch {
      /* storage blocked */
    }
  }, [id]);
  return null;
}

/** "Recently viewed" rail; renders nothing until there is history. */
export function RecentlyViewed({ title, exclude }: { title: string; exclude?: string }) {
  const [cars, setCars] = useState<PublicListing[]>([]);
  useEffect(() => {
    const ids = readRecent().filter((x) => x !== exclude);
    if (!ids.length) return;
    fetch(`/api/site/cars/batch?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((d) => setCars((d.listings || []).slice(0, 4)))
      .catch(() => undefined);
  }, [exclude]);
  if (!cars.length) return null;
  return (
    <section className="site-section mk-wrap home-block">
      <div className="home-block-head"><h2>{title}</h2></div>
      <div className="mk-grid">{cars.map((c) => <ListingCard key={c._id} car={c} />)}</div>
    </section>
  );
}

/** Native share sheet on phones; WhatsApp link elsewhere. */
export function ShareButton({ title, text, label }: { title: string; text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* cancelled: fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
    }
  }
  return (
    <button type="button" className="mk-share" onClick={share}>
      ↗ {copied ? "Link copied" : label}
    </button>
  );
}
