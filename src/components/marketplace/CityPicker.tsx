"use client";

import { useRouter } from "next/navigation";
import { CITY_COOKIE } from "@/lib/i18n";
import { CITIES, MAJOR_CITIES } from "@/lib/catalog";

/** "📍 Islamabad" in the header: searches open on this city first. */
export function CityPicker({ city }: { city?: string }) {
  const router = useRouter();
  function choose(value: string) {
    document.cookie = value
      ? `${CITY_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
      : `${CITY_COOKIE}=; path=/; max-age=0`;
    router.refresh();
  }
  return (
    <label className="city-pick" title="Your city: cars here are shown first">
      <span aria-hidden>📍</span>
      <select value={city || ""} onChange={(e) => choose(e.target.value)} aria-label="Your city">
        <option value="">All Pakistan</option>
        <optgroup label="Major cities">{MAJOR_CITIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
        <optgroup label="All cities">{CITIES.filter((c) => !MAJOR_CITIES.includes(c)).map((c) => <option key={c}>{c}</option>)}</optgroup>
      </select>
    </label>
  );
}
