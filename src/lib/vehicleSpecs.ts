/**
 * Detailed vehicle specification + feature catalogue (PakWheels-style).
 * One catalogue drives the admin form, the seller's ad form, the public
 * detail page, compare, and server-side validation, so they never drift.
 * Values are stored as `specs: Record<key, string | number | boolean>` and
 * `features: string[]` (feature labels, so older free-text features still work).
 */

export type VehicleKind = "car" | "bike";
type Applies = VehicleKind | "both";

export type SpecField = {
  key: string;
  label: string;
  group: SpecGroupKey;
  type: "select" | "number" | "text" | "bool";
  options?: readonly string[];
  unit?: string;
  min?: number;
  max?: number;
  applies: Applies;
  /** Shown on the detail page's at-a-glance strip. */
  highlight?: boolean;
};

export const SPEC_GROUPS = [
  { key: "history", label: "Ownership & history" },
  { key: "documents", label: "Documents & registration" },
  { key: "engine", label: "Engine & performance" },
  { key: "dimensions", label: "Body & capacity" },
  { key: "running", label: "Wheels, brakes & suspension" },
  { key: "condition", label: "Condition" },
] as const;
export type SpecGroupKey = (typeof SPEC_GROUPS)[number]["key"];

const yearNow = new Date().getFullYear();

export const SPEC_FIELDS: readonly SpecField[] = [
  // Ownership & history
  { key: "assembly", label: "Assembly", group: "history", type: "select", options: ["Local", "Imported"], applies: "both", highlight: true },
  { key: "importYear", label: "Import year", group: "history", type: "number", min: 1970, max: yearNow + 1, applies: "both" },
  { key: "importedFrom", label: "Imported from", group: "history", type: "select", options: ["Japan", "UAE", "UK", "Thailand", "China", "Korea", "Other"], applies: "both" },
  { key: "ownership", label: "Ownership", group: "history", type: "select", options: ["First owner", "Second owner", "Third owner", "Fourth owner or more"], applies: "both", highlight: true },
  { key: "accidentHistory", label: "Accident history", group: "history", type: "select", options: ["No accident", "Minor (cosmetic)", "Major (repaired)"], applies: "both", highlight: true },
  { key: "serviceHistory", label: "Service history", group: "history", type: "select", options: ["Complete dealer record", "Partial record", "No record"], applies: "both" },
  { key: "lastServiceKm", label: "Last service at", group: "history", type: "number", unit: "km", min: 0, max: 2_000_000, applies: "both" },
  { key: "warranty", label: "Warranty", group: "history", type: "text", applies: "both" },

  // Documents & registration
  { key: "registrationCity", label: "Registration city", group: "documents", type: "text", applies: "both" },
  { key: "registrationYear", label: "Registration year", group: "documents", type: "number", min: 1970, max: yearNow + 1, applies: "both" },
  { key: "unregistered", label: "Unregistered", group: "documents", type: "bool", applies: "both" },
  { key: "tokenTaxPaidUpTo", label: "Token tax paid up to", group: "documents", type: "number", min: 1990, max: yearNow + 10, applies: "both" },
  { key: "originalBook", label: "Original registration book", group: "documents", type: "bool", applies: "both" },
  { key: "originalFile", label: "Complete original file", group: "documents", type: "bool", applies: "both" },
  { key: "smartCard", label: "Smart card registration", group: "documents", type: "bool", applies: "both" },
  { key: "biometricAvailable", label: "Owner available for biometric transfer", group: "documents", type: "bool", applies: "both" },
  { key: "numberPlate", label: "Number plate", group: "documents", type: "select", options: ["Computerised", "Standard", "Custom/fancy", "Applied for"], applies: "both" },
  { key: "keys", label: "Keys", group: "documents", type: "number", min: 0, max: 5, applies: "both" },

  // Engine & performance
  { key: "engineType", label: "Engine type", group: "engine", type: "text", applies: "both" },
  { key: "cylinders", label: "Cylinders", group: "engine", type: "number", min: 1, max: 16, applies: "both" },
  { key: "horsepower", label: "Horsepower", group: "engine", type: "number", unit: "hp", min: 0, max: 2000, applies: "both" },
  { key: "torque", label: "Torque", group: "engine", type: "number", unit: "Nm", min: 0, max: 2000, applies: "both" },
  { key: "driveType", label: "Drive type", group: "engine", type: "select", options: ["FWD", "RWD", "4WD", "AWD"], applies: "car", highlight: true },
  { key: "gears", label: "Gears", group: "engine", type: "number", min: 1, max: 12, applies: "both" },
  { key: "fuelAverageCity", label: "Fuel average (city)", group: "engine", type: "number", unit: "km/l", min: 0, max: 100, applies: "both", highlight: true },
  { key: "fuelAverageHighway", label: "Fuel average (highway)", group: "engine", type: "number", unit: "km/l", min: 0, max: 100, applies: "both" },
  { key: "fuelTank", label: "Fuel tank", group: "engine", type: "number", unit: "L", min: 0, max: 200, applies: "both" },
  { key: "batteryCapacity", label: "Battery capacity (EV/hybrid)", group: "engine", type: "number", unit: "kWh", min: 0, max: 300, applies: "both" },
  { key: "electricRange", label: "Electric range", group: "engine", type: "number", unit: "km", min: 0, max: 1500, applies: "both" },
  { key: "topSpeed", label: "Top speed", group: "engine", type: "number", unit: "km/h", min: 0, max: 450, applies: "both" },
  { key: "startType", label: "Start type", group: "engine", type: "select", options: ["Kick start", "Self start", "Kick & self"], applies: "bike", highlight: true },
  { key: "stroke", label: "Engine stroke", group: "engine", type: "select", options: ["2-stroke", "4-stroke"], applies: "bike" },
  { key: "cooling", label: "Cooling", group: "engine", type: "select", options: ["Air cooled", "Oil cooled", "Liquid cooled"], applies: "bike" },

  // Body & capacity
  { key: "seats", label: "Seating capacity", group: "dimensions", type: "number", min: 1, max: 60, applies: "car", highlight: true },
  { key: "doors", label: "Doors", group: "dimensions", type: "number", min: 2, max: 6, applies: "car" },
  { key: "interiorColor", label: "Interior colour", group: "dimensions", type: "text", applies: "car" },
  { key: "upholstery", label: "Upholstery", group: "dimensions", type: "select", options: ["Fabric", "Leather", "Leatherette", "Alcantara"], applies: "car" },
  { key: "bootSpace", label: "Boot space", group: "dimensions", type: "number", unit: "L", min: 0, max: 3000, applies: "car" },
  { key: "groundClearance", label: "Ground clearance", group: "dimensions", type: "number", unit: "mm", min: 0, max: 500, applies: "both" },
  { key: "length", label: "Length", group: "dimensions", type: "number", unit: "mm", min: 0, max: 15000, applies: "both" },
  { key: "width", label: "Width", group: "dimensions", type: "number", unit: "mm", min: 0, max: 3000, applies: "both" },
  { key: "kerbWeight", label: "Kerb weight", group: "dimensions", type: "number", unit: "kg", min: 0, max: 10000, applies: "both" },

  // Wheels, brakes & suspension
  { key: "wheelSize", label: "Wheel size", group: "running", type: "number", unit: "inch", min: 10, max: 24, applies: "both" },
  { key: "tyreSize", label: "Tyre size", group: "running", type: "text", applies: "both" },
  { key: "frontBrakes", label: "Front brakes", group: "running", type: "select", options: ["Disc", "Ventilated disc", "Drum"], applies: "both" },
  { key: "rearBrakes", label: "Rear brakes", group: "running", type: "select", options: ["Disc", "Ventilated disc", "Drum"], applies: "both" },
  { key: "frontSuspension", label: "Front suspension", group: "running", type: "text", applies: "both" },
  { key: "rearSuspension", label: "Rear suspension", group: "running", type: "text", applies: "both" },

  // Condition
  { key: "exteriorCondition", label: "Exterior condition", group: "condition", type: "select", options: ["Excellent", "Good", "Fair", "Needs work"], applies: "both" },
  { key: "interiorCondition", label: "Interior condition", group: "condition", type: "select", options: ["Excellent", "Good", "Fair", "Needs work"], applies: "car" },
  { key: "paint", label: "Paint", group: "condition", type: "select", options: ["Total genuine", "Minor touch-ups", "Partially repainted", "Fully repainted"], applies: "both", highlight: true },
  { key: "tyreLife", label: "Tyre life remaining", group: "condition", type: "number", unit: "%", min: 0, max: 100, applies: "both" },
  { key: "batteryHealth", label: "Battery", group: "condition", type: "select", options: ["New (under 1 year)", "Good", "Needs replacement"], applies: "both" },
  { key: "acWorking", label: "AC fully working", group: "condition", type: "bool", applies: "car" },
];

export const FEATURE_GROUPS: { key: string; label: string; applies: Applies; items: readonly string[] }[] = [
  {
    key: "safety",
    label: "Safety",
    applies: "car",
    items: [
      "Driver airbag", "Passenger airbag", "Side airbags", "Curtain airbags", "Knee airbag",
      "ABS", "EBD", "Brake assist", "Traction control", "Stability control (VSC/ESP)", "Hill start assist",
      "Hill descent control", "ISOFIX child seat mounts", "Immobilizer", "Central locking", "Keyless entry",
      "Anti-theft alarm", "Tyre pressure monitor", "Lane departure warning", "Lane keep assist",
      "Blind spot monitor", "Forward collision warning", "Automatic emergency braking", "Adaptive cruise control",
      "Rear cross-traffic alert", "Driver attention alert",
    ],
  },
  {
    key: "comfort",
    label: "Comfort & convenience",
    applies: "car",
    items: [
      "Air conditioning", "Climate control", "Dual-zone climate control", "Rear AC vents", "Cool box",
      "Power steering", "Power windows (front)", "Power windows (rear)", "Power mirrors", "Retractable mirrors",
      "Heated mirrors", "Push start", "Remote engine start", "Cruise control", "Steering-mounted controls",
      "Tilt steering", "Telescopic steering", "Power seats (driver)", "Power seats (passenger)", "Seat memory",
      "Heated seats", "Ventilated seats", "Rear armrest", "Folding rear seats", "Auto-dimming mirror",
      "Rain-sensing wipers", "Auto headlights", "Paddle shifters", "Electric parking brake", "Auto hold",
      "Wireless charger", "Power tailgate",
    ],
  },
  {
    key: "infotainment",
    label: "Infotainment & technology",
    applies: "car",
    items: [
      "Touchscreen", "Navigation", "Apple CarPlay", "Android Auto", "Bluetooth", "USB ports", "AUX input",
      "CD/DVD player", "Premium sound system", "Rear-seat entertainment", "Digital instrument cluster",
      "Head-up display", "Front camera", "Rear camera", "360° camera", "Front parking sensors",
      "Rear parking sensors", "Self-parking", "Voice commands", "Connected car app",
    ],
  },
  {
    key: "exterior",
    label: "Exterior",
    applies: "car",
    items: [
      "Alloy rims", "LED headlights", "HID / xenon headlights", "Projector headlights", "DRLs (daytime lights)",
      "Fog lights", "LED tail lights", "Sunroof", "Panoramic roof", "Roof rails", "Spoiler", "Side steps",
      "Tow bar", "Chrome trim", "Tinted glass", "Body kit", "Spare tyre", "Mud flaps",
    ],
  },
  {
    key: "bike_features",
    label: "Bike features",
    applies: "bike",
    items: [
      "Self start", "Kick start", "Alloy wheels", "Tubeless tyres", "Front disc brake", "Rear disc brake",
      "ABS", "Combined braking (CBS)", "Digital meter", "Fuel gauge", "Gear indicator", "LED headlight",
      "LED tail light", "Mobile charger (USB)", "Side-stand engine cut-off", "Pass light", "Hazard lights",
      "Engine kill switch", "Mono-shock suspension", "Telescopic front forks", "Rear carrier", "Side box / bag",
      "Saree guard", "Crash guard", "Anti-theft alarm", "Tracker", "Body cover", "Helmet included",
    ],
  },
];

export type Specs = Record<string, string | number | boolean>;

export const specsFor = (kind: VehicleKind) => SPEC_FIELDS.filter((f) => f.applies === "both" || f.applies === kind);
export const featureGroupsFor = (kind: VehicleKind) => FEATURE_GROUPS.filter((g) => g.applies === "both" || g.applies === kind);

const BY_KEY = new Map(SPEC_FIELDS.map((f) => [f.key, f]));

/**
 * Keeps only catalogue keys with values of the right type and range, dropping
 * blanks. Used on the server (never trust the form) and before saving forms.
 */
export function cleanSpecs(input: unknown, kind: VehicleKind): Specs {
  const out: Specs = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const f = BY_KEY.get(key);
    if (!f || !(f.applies === "both" || f.applies === kind)) continue;
    if (raw === null || raw === undefined || raw === "") continue;
    if (f.type === "bool") {
      if (raw === true || raw === "true") out[key] = true;
      else if (raw === false || raw === "false") out[key] = false;
    } else if (f.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) continue;
      out[key] = n;
    } else if (f.type === "select") {
      if (typeof raw === "string" && f.options?.includes(raw)) out[key] = raw;
    } else if (typeof raw === "string" && raw.trim()) {
      out[key] = raw.trim().slice(0, 80);
    }
  }
  return out;
}

/** Human text for one spec value ("12 km/l", "Yes", "First owner"). */
export function specText(f: SpecField, v: string | number | boolean | undefined): string | undefined {
  if (v === undefined || v === "") return undefined;
  if (f.type === "bool") return v ? "Yes" : "No";
  // Years read as "2021", not "2,021".
  if (f.type === "number") return `${/Year$|UpTo$/.test(f.key) ? String(v) : Number(v).toLocaleString()}${f.unit ? ` ${f.unit}` : ""}`;
  return String(v);
}

/** Grouped, non-empty spec rows for display. */
export function specRows(specs: Specs | undefined, kind: VehicleKind) {
  const list = specsFor(kind);
  return SPEC_GROUPS.map((g) => ({
    ...g,
    rows: list
      .filter((f) => f.group === g.key)
      .map((f) => ({ field: f, text: specText(f, specs?.[f.key]) }))
      .filter((r): r is { field: SpecField; text: string } => Boolean(r.text)),
  })).filter((g) => g.rows.length);
}

/** Features split into catalogue groups plus anything typed free-hand. */
export function groupFeatures(features: string[], kind: VehicleKind) {
  const have = new Set(features.map((x) => x.toLowerCase()));
  const known = new Set<string>();
  const groups = featureGroupsFor(kind).map((g) => {
    g.items.forEach((i) => known.add(i.toLowerCase()));
    return { key: g.key, label: g.label, items: g.items.map((name) => ({ name, has: have.has(name.toLowerCase()) })) };
  });
  const other = features.filter((x) => !known.has(x.toLowerCase()));
  return { groups, other };
}

/* ------------------------------------------------ video & identity helpers */

const VIDEO_HOSTS = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vimeo\.com)\//i;

export const isVideoUrl = (v: string) => VIDEO_HOSTS.test(v.trim());

/** Embeddable URL for YouTube/Vimeo; other hosts are shown as a link. */
export function videoEmbed(url?: string) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

/** "LEA-22-1234" / "lea 22 1234" → "REG:LEA221234"; chassis → "VIN:…". */
export function identityKeys(v: { registrationNo?: string | null; vin?: string | null; chassisNo?: string | null }) {
  const keys: string[] = [];
  const reg = (v.registrationNo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (reg.length >= 4) keys.push(`REG:${reg}`);
  const chassis = (v.vin || v.chassisNo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (chassis.length >= 6) keys.push(`VIN:${chassis}`);
  return keys;
}
