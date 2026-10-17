/**
 * Plain-language search: "family car under 30 lakh, automatic, good mileage",
 * Roman Urdu ("sasti automatic gari 25 lakh tak Lahore mein") or Urdu script
 * ("30 لاکھ تک آٹومیٹک گاڑی"). Rule-based on purpose: instant, free, private,
 * and every interpretation is shown back to the user as a removable chip.
 */
import { BIKE_MODELS, CAR_MODELS, CITIES } from "@/lib/catalog";

export type SmartFilters = {
  type?: "car" | "bike";
  make?: string;
  model?: string;
  city?: string;
  bodies?: string[];
  /** Body types to leave out (listings without a body type still show). */
  excludeBodies?: string[];
  fuel?: string;
  transmission?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  maxKm?: number;
  minSeats?: number;
  minFuelAvg?: number;
  maxCc?: number;
  minCc?: number;
  assembly?: "Local" | "Imported";
  firstOwner?: boolean;
  accidentFree?: boolean;
  genuinePaint?: boolean;
  features?: string[];
  sort?: string;
};

export type SmartResult = { filters: SmartFilters; understood: string[] };

/** All makes → models (cars and bikes) from the site catalogue. */
export const KNOWN_MODELS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const book of [CAR_MODELS, BIKE_MODELS]) {
    for (const [make, models] of Object.entries(book)) out[make] = [...new Set([...(out[make] || []), ...models])];
  }
  return out;
})();

const AMBIGUOUS_MODELS = new Set(["city", "fit", "life", "move", "grace", "note", "every", "joy", "sport", "seal", "dolphin", "alpha", "storm", "cast", "boon", "flair", "rocky", "pearl", "premium", "infinity", "jackpot", "bravo", "excel", "rio", "dream", "freed", "zest", "mirage", "crown", "shark 6", "carrier", "exclusive", "raider", "sprinter", "metro", "primavera", "sprint", "khyber", "ravi", "frontier", "gt", "vogue", "velar", "evoque", "kicks", "patrol", "insight", "liana", "a class", "g class", "sorento"]);

/** Everyday short names for catalogue models. */
const MODEL_ALIASES: [RegExp, string, string][] = [
  [/\bprado\b/, "Toyota", "Land Cruiser Prado"],
  [/\b(revo|hilux revo)\b/, "Toyota", "Hilux Revo"],
  [/\bv8\b|\bland cruiser\b(?! prado)/, "Toyota", "Land Cruiser"],
  [/\bwagon ?r\b|\bwagonr\b/, "Suzuki", "Wagon R"],
  [/\bcd ?70\b|\bhonda 70\b/, "Honda", "CD 70"],
  [/\bcg ?125\b|\bhonda 125\b/, "Honda", "CG 125"],
  [/\bybr\b(?![\s-]*125)/, "Yamaha", "YBR 125"],
  [/\bmerc(edes)?\b|\bbenz\b/, "Mercedes Benz", ""],
];

const BIKE_MODELS_SET = new Set(Object.values(BIKE_MODELS).flat());

const URDU_CITIES: Record<string, string> = { لاہور: "Lahore", کراچی: "Karachi", اسلام: "Islamabad", راولپنڈی: "Rawalpindi", فیصل: "Faisalabad", ملتان: "Multan", پشاور: "Peshawar", کوئٹہ: "Quetta" };

const FEATURE_WORDS: [RegExp, string][] = [
  [/sun ?roof|سن ?روف/, "Sunroof"],
  [/push ?start/, "Push start"],
  [/navigation|\bnav\b/, "Navigation"],
  [/climate control/, "Climate control"],
  [/(rear|reverse|back) ?camera/, "Rear camera"],
  [/cruise/, "Cruise control"],
  [/alloy/, "Alloy rims"],
  [/\babs\b/, "ABS"],
  [/carplay/, "Apple CarPlay"],
  [/android auto/, "Android Auto"],
  [/self ?start/, "Self start"],
  [/disc brake/, "Front disc brake"],
];

/** "30 lakh" → 3,000,000; "1.5 crore" → 15,000,000; "450k" → 450,000. */
function amount(num: string, unit?: string) {
  const n = Number(num.replace(/,/g, ""));
  if (!Number.isFinite(n)) return undefined;
  const u = (unit || "").toLowerCase();
  if (/^(lakh|lac|lacs|lakhs|laakh|l|لاکھ)$/.test(u)) return Math.round(n * 100_000);
  if (/^(crore|cr|karor|karore|crores|کروڑ)$/.test(u)) return Math.round(n * 10_000_000);
  if (/^(k|thousand|hazar|hazaar|ہزار)$/.test(u)) return Math.round(n * 1000);
  if (/^(m|million)$/.test(u)) return Math.round(n * 1_000_000);
  return n >= 10_000 ? n : undefined; // bare small numbers are not prices
}

const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UNIT = "(lakhs?|lacs?|laakh|crores?|cr|karore?|thousand|hazaa?r|million|k|m|l|لاکھ|کروڑ|ہزار)";

export function parseSmartQuery(raw: string, extraMakes: string[] = []): SmartResult {
  const f: SmartFilters = {};
  const understood: string[] = [];
  let q = ` ${raw.toLowerCase().replace(/[،,]/g, " ").replace(/\s+/g, " ")} `;
  const take = (rx: RegExp) => {
    const m = q.match(rx);
    if (m) q = q.replace(m[0], " ");
    return m;
  };
  const fmt = (n: number) => (n >= 10_000_000 ? `${+(n / 10_000_000).toFixed(2)} crore` : n >= 100_000 ? `${+(n / 100_000).toFixed(1)} lakh` : n.toLocaleString());

  // Vehicle type
  if (/\b(bike|bikes|motorbike|motorcycle|motor ?cycle|scooter|scooty)\b|بائیک|موٹر ?سائیکل/.test(q)) { f.type = "bike"; understood.push("Bikes"); }
  else if (/\b(car|cars|gari|gaari|gadi|gaadi|vehicle)\b|گاڑی|کار/.test(q)) f.type = "car";

  // Mileage: "under 50,000 km", "50k km se kam", "low mileage"
  let m = take(/(?:under|below|less than|max|upto|up to)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|hazar)?\s*(?:km|kms|kilometers?)\b(?:\s*(?:se kam|tak|or less))?/);
  if (m) { const v = Math.round(Number(m[1]) * (m[2] ? 1000 : 1)); if (v >= 1000) { f.maxKm = v; understood.push(`Under ${v.toLocaleString()} km`); } }
  if (!f.maxKm && take(/\blow (mileage|km|kms)\b|kam chali|کم چلی/)) { f.maxKm = 50_000; understood.push("Under 50,000 km"); }

  // Price ranges: "between 20 and 30 lakh", "20-30 lakh", "20 se 30 lakh"
  m = take(new RegExp(`(?:between|from|bich|darmiyan)?\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}?\\s*(?:-|to|and|se|سے|تا)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}`));
  if (m) {
    const hi = amount(m[3], m[4]);
    const lo = amount(m[1], m[2] || m[4]);
    if (lo && hi) { f.minPrice = Math.min(lo, hi); f.maxPrice = Math.max(lo, hi); understood.push(`${fmt(f.minPrice)} – ${fmt(f.maxPrice)}`); }
  }
  // "under 30 lakh", "30 lakh tak", "30 lakh se kam", "max 30 lakh", "budget 30 lakh"
  if (!f.maxPrice) {
    m = take(new RegExp(`(?:under|below|less than|upto|up to|within|max|maximum|budget|andar|tak)\\s*(?:rs\\.?|pkr)?\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}`)) ||
      take(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\s*(?:tak|takk|se kam|sy kam|or less|and below|max|تک|سے کم|کے اندر)`));
    if (m) { const v = amount(m[1], m[2]); if (v) { f.maxPrice = v; understood.push(`Under ${fmt(v)}`); } }
  }
  if (!f.minPrice) {
    m = take(new RegExp(`(?:above|over|more than|min|minimum|at least)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}`)) ||
      take(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\s*(?:se zyada|sy zyada|se upar|plus|\\+|سے زیادہ)`));
    if (m) { const v = amount(m[1], m[2]); if (v) { f.minPrice = v; understood.push(`Over ${fmt(v)}`); } }
  }
  // A lone "30 lakh" means "around": ±10%.
  if (!f.minPrice && !f.maxPrice) {
    m = take(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT}(?=\\s)`));
    if (m && !/^(k|m)$/.test(m[2]) ) {
      const v = amount(m[1], m[2]);
      if (v) { f.minPrice = Math.round(v * 0.9); f.maxPrice = Math.round(v * 1.1); understood.push(`Around ${fmt(v)}`); }
    }
  }

  // Years: "2018-2021", "after 2016", "2018 or newer", "2020 model"
  m = take(/\b(19[89]\d|20[0-3]\d)\s*(?:-|to|se|سے)\s*(19[89]\d|20[0-3]\d)\b/);
  if (m) { f.minYear = Math.min(+m[1], +m[2]); f.maxYear = Math.max(+m[1], +m[2]); understood.push(`${f.minYear}–${f.maxYear}`); }
  else {
    m = take(/(?:after|newer than|from|since|above|ke baad|کے بعد)\s*(19[89]\d|20[0-3]\d)\b|\b(19[89]\d|20[0-3]\d)\s*(?:or newer|and above|\+|onwards|ke baad|se upar)/);
    if (m) { f.minYear = +(m[1] || m[2]); understood.push(`${f.minYear} or newer`); }
    else {
      m = take(/(?:before|older than|until|upto)\s*(19[89]\d|20[0-3]\d)\b/);
      if (m) { f.maxYear = +m[1]; understood.push(`Up to ${f.maxYear}`); }
      else {
        m = take(/\b(19[89]\d|20[0-3]\d)\b(?:\s*model)?/);
        if (m) { f.minYear = f.maxYear = +m[1]; understood.push(`${m[1]} model`); }
      }
    }
  }
  if (!f.minYear && take(/\b(new|nayi|nai|latest|recent)\b(?! condition)|نئی/)) { f.minYear = new Date().getFullYear() - 3; understood.push(`${f.minYear} or newer`); }

  // Gearbox / fuel
  if (take(/\b(automatic|auto)\b|آٹومیٹک/)) { f.transmission = "Automatic"; understood.push("Automatic"); }
  else if (take(/\b(manual|mt|stick)\b|مینول/)) { f.transmission = "Manual"; understood.push("Manual"); }
  const fuels: [RegExp, string][] = [[/\bhybrid\b|ہائبرڈ/, "Hybrid"], [/\bdiesel\b|ڈیزل/, "Diesel"], [/\b(electric|ev)\b|الیکٹرک/, "Electric"], [/\bcng\b/, "CNG"], [/\bpetrol\b|پیٹرول/, "Petrol"]];
  for (const [rx, v] of fuels) if (take(rx)) { f.fuel = v; understood.push(v); break; }

  // Body / purpose
  const bodies: [RegExp, string[], string][] = [
    [/\b(suv|jeep|4x4|four by four|off ?road)\b|جیپ/, ["SUV", "Crossover"], "SUV / crossover"],
    [/\bsedan\b/, ["Sedan"], "Sedan"],
    [/\b(hatchback|hatch|small car|choti gari|chhoti gari|city car)\b|چھوٹی گاڑی/, ["Hatchback"], "Hatchback"],
    [/\b(pickup|pick up|dala|double cabin|single cabin)\b/, ["Pickup"], "Pickup"],
    [/\b(van|hiace|carry)\b/, ["Van", "MPV"], "Van / MPV"],
    [/\b(mpv|7 seater|seven seater|8 seater)\b/, ["MPV", "SUV", "Van"], "7+ seats"],
    [/\bscooter|scooty\b/, ["Scooter"], "Scooter"],
    [/\bsports? bike\b|heavy bike/, ["Sports"], "Sports bike"],
  ];
  for (const [rx, list, label] of bodies) if (take(rx)) { f.bodies = list; understood.push(label); if (label === "7+ seats") f.minSeats = 7; break; }
  if (take(/\b(family|ghar wal[ie]|ghar ke liye|بڑی فیملی|فیملی)\b|فیملی/)) {
    if (!f.bodies) f.excludeBodies = ["Coupe", "Pickup"];
    f.minSeats = f.minSeats || 5;
    understood.push("Family-sized");
  }
  if (take(/\b(good|best|high|great|excellent) (mileage|fuel average|average|fuel economy)\b|fuel efficient|economical|kam (petrol|kharch|kharcha)|petrol bachat|achi average|achhi average|کم خرچ|اچھی ایوریج/)) {
    if (f.type !== "bike") { f.minFuelAvg = 14; understood.push("Fuel-efficient (14+ km/l, hybrid or ≤1300cc)"); }
  }
  m = take(/\b(\d{2,4})\s*cc\b/);
  if (m) { const cc = +m[1]; f.minCc = Math.round(cc * 0.9); f.maxCc = Math.round(cc * 1.1); understood.push(`${cc} cc`); }

  // History & condition words
  if (take(/\b(imported|import|japanese|reconditioned)\b|امپورٹڈ/)) { f.assembly = "Imported"; understood.push("Imported"); }
  else if (take(/\b(local|locally assembled)\b|لوکل/)) { f.assembly = "Local"; understood.push("Local assembly"); }
  if (take(/\bfirst owner|1st owner|pehla malik|پہلا مالک/)) { f.firstOwner = true; understood.push("First owner"); }
  if (take(/\baccident free|no accident|non accident|accidental nahi|بغیر حادثہ/)) { f.accidentFree = true; understood.push("Accident-free"); }
  if (take(/\b(total genuine|genuine paint|original paint|bumper to bumper)\b|اصل رنگ/)) { f.genuinePaint = true; understood.push("Total genuine paint"); }

  const feats: string[] = [];
  for (const [rx, name] of FEATURE_WORDS) if (take(rx)) feats.push(name);
  if (feats.length) { f.features = feats; understood.push(...feats.map((x) => `With ${x.toLowerCase()}`)); }

  // City (English names, Urdu names, "Lahore mein")
  for (const c of [...CITIES].sort((a, b) => b.length - a.length)) if (take(new RegExp(`\\b${esc(c.toLowerCase())}\\b`))) { f.city = c; understood.push(`In ${c}`); break; }
  if (!f.city) for (const [u, c] of Object.entries(URDU_CITIES)) if (q.includes(u)) { f.city = c; understood.push(`In ${c}`); break; }

  // Make + model: try models first (more specific), then makes.
  const catalogue: Record<string, string[]> = { ...KNOWN_MODELS };
  for (const mk of extraMakes) if (!Object.keys(catalogue).some((k) => k.toLowerCase() === mk.toLowerCase())) catalogue[mk] = [];
  for (const [rx, make, model] of MODEL_ALIASES) {
    if (take(rx)) { f.make = make; if (model) f.model = model; understood.push(model ? `${make} ${model}` : make); break; }
  }
  if (!f.make) outer: for (const [make, models] of Object.entries(catalogue)) {
    for (const model of [...models].sort((a, b) => b.length - a.length)) {
      const body = esc(model.toLowerCase()).replace(/[\s-]+/g, "[\\s-]*");
      // Models that are everyday words ("City", "Fit", MG "5") only count after their brand.
      const rx = AMBIGUOUS_MODELS.has(model.toLowerCase()) || /^\d+$/.test(model)
        ? new RegExp(`\\b${esc(make.toLowerCase())}\\s+${body}\\b`)
        : new RegExp(`\\b${body}\\b`);
      if (take(rx)) { f.make = make; f.model = model; understood.push(`${make} ${model}`); break outer; }
    }
  }
  if (!f.make) for (const make of Object.keys(catalogue)) if (take(new RegExp(`\\b${esc(make.toLowerCase())}\\b`))) { f.make = make; understood.push(make); break; }
  if (f.model && BIKE_MODELS_SET.has(f.model)) f.type = "bike";

  // Sorting words
  if (take(/\b(cheap|cheapest|sasti|sasta|kam qeemat|lowest price)\b|سستی|سستا/)) { f.sort = "price_asc"; understood.push("Cheapest first"); }
  else if (take(/\b(lowest mileage|least driven)\b/)) { f.sort = "km_asc"; understood.push("Lowest mileage first"); }

  return { filters: f, understood };
}
