/**
 * "Parts for my car": turns a chosen vehicle into a database filter so a
 * search for a specific model only returns parts that fit it. Universal items
 * (oils, car care, gadgets) are left out unless the shopper asks for them.
 */
export type VehiclePick = { kind?: "car" | "bike"; make?: string; model?: string; year?: number };

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;
/** Year keys are generated within this window; open-ended ranges are clamped to it. */
const KEY_YEAR_FROM = 1980;
const keyYearTo = () => new Date().getFullYear() + 2;

export type Fitment = { make: string; model?: string; yearFrom?: number; yearTo?: number };

/** Stored form: trimmed, with both year bounds present (open ends become 1900 / 2100). */
export function normaliseFitments(list: Fitment[]): Fitment[] {
  return list.map((f) => ({ make: f.make.trim(), model: f.model?.trim() || undefined, yearFrom: f.yearFrom || YEAR_MIN, yearTo: f.yearTo || YEAR_MAX }));
}

const k = (s: string) => s.trim().toLowerCase();

/**
 * Flat match keys for a fitment list, so "fits my car" is a plain `$in` on a
 * string array (runs the same on MongoDB, DocumentDB, Cosmos and FerretDB):
 *   make|model|*       fits that model (any year)       make|**|*   fits some model of that make
 *   make|model|2018    fits that model in 2018          make|**|2018
 *   make|*|…           fitment for every model of the make
 *   …|any              no year limits at all
 * Open-ended year ranges are expanded up to two years ahead; saving the
 * product again refreshes them.
 */
export function fitmentKeys(list: Fitment[]): string[] {
  const keys = new Set<string>();
  for (const f of normaliseFitments(list)) {
    const mk = k(f.make);
    const md = f.model ? k(f.model) : "*";
    keys.add(`${mk}|${md}|*`);
    keys.add(`${mk}|**|*`);
    const open = f.yearFrom === YEAR_MIN && f.yearTo === YEAR_MAX;
    if (open) {
      keys.add(`${mk}|${md}|any`);
      keys.add(`${mk}|**|any`);
      continue;
    }
    const from = Math.max(f.yearFrom!, KEY_YEAR_FROM);
    const to = Math.min(f.yearTo!, keyYearTo());
    for (let y = from; y <= to; y++) {
      keys.add(`${mk}|${md}|${y}`);
      keys.add(`${mk}|**|${y}`);
    }
  }
  return [...keys];
}

/** Filter on a `fitKeys` field for a chosen vehicle (null when no make is chosen). */
export function fitmentFilter(field: string, pick: VehiclePick, includeUniversal: boolean, universalField: string) {
  if (!pick.make) return null;
  const mk = k(pick.make);
  const models = pick.model ? [k(pick.model), "*"] : ["**"];
  const years = pick.year ? [String(pick.year), "any"] : ["*"];
  const wanted = models.flatMap((m) => years.map((y) => `${mk}|${m}|${y}`));
  const fitsQ = { [field]: { $in: wanted } };
  return includeUniversal ? { $or: [fitsQ, { [universalField]: true }] } : fitsQ;
}

export function fitmentLabel(raw: { make: string; model?: string; yearFrom?: number; yearTo?: number }) {
  const f = { ...raw, yearFrom: raw.yearFrom === YEAR_MIN ? undefined : raw.yearFrom, yearTo: raw.yearTo === YEAR_MAX ? undefined : raw.yearTo };
  const years = f.yearFrom && f.yearTo ? (f.yearFrom === f.yearTo ? `${f.yearFrom}` : `${f.yearFrom}–${f.yearTo}`) : f.yearFrom ? `${f.yearFrom}+` : f.yearTo ? `up to ${f.yearTo}` : "";
  return [f.make, f.model || "all models", years].filter(Boolean).join(" ");
}

/** Does a product's fitment list fit this vehicle? (for "✓ Fits your car" badges) */
export function fits(fitments: { make: string; model?: string; yearFrom?: number; yearTo?: number }[], pick: VehiclePick) {
  if (!pick.make) return false;
  return fitments.some(
    (f) =>
      f.make.toLowerCase() === pick.make!.toLowerCase() &&
      (!f.model || !pick.model || f.model.toLowerCase() === pick.model.toLowerCase()) &&
      (!pick.year || ((!f.yearFrom || f.yearFrom <= pick.year) && (!f.yearTo || f.yearTo >= pick.year)))
  );
}

/** Stored fitments → form rows (drops the open-ended year placeholders and match keys). */
export function editableFitments(list: { make: string; model?: string; yearFrom?: number; yearTo?: number }[] = []) {
  return list.map(({ make, model, yearFrom, yearTo }) => ({
    make,
    model: model || undefined,
    yearFrom: yearFrom && yearFrom !== YEAR_MIN ? yearFrom : undefined,
    yearTo: yearTo && yearTo !== YEAR_MAX ? yearTo : undefined,
  }));
}
