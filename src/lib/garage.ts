/** My Garage reminder maths, shared by the server (badges) and the page. */

export const SERVICE_TYPES = [
  "Oil change",
  "General service",
  "Tyres",
  "Battery",
  "Brakes",
  "AC service",
  "Tuning",
  "Body / paint",
  "Repair",
  "Token tax paid",
  "Insurance renewed",
  "Other",
] as const;

export type GarageCarLike = {
  km: number;
  kmUpdatedAt: string | Date;
  dailyKm: number;
  oilIntervalKm: number;
  lastOilKm?: number;
  serviceIntervalKm: number;
  lastServiceKm?: number;
  tokenTaxDue?: string | Date;
  insuranceDue?: string | Date;
};

export type Reminder = {
  key: "oil" | "service" | "token" | "insurance";
  label: string;
  status: "overdue" | "soon" | "ok" | "unknown";
  detail: string;
  /** For calendar export. */
  dueDate?: string;
  /** Shop category to suggest when this is due. */
  shopCategory?: string;
};

const DAY = 86_400_000;
const SOON_KM = 500;
const SOON_DAYS = 30;

export function estimatedKm(c: GarageCarLike, now = Date.now()) {
  const days = Math.max(0, (now - new Date(c.kmUpdatedAt).getTime()) / DAY);
  return Math.round(c.km + days * (c.dailyKm || 0));
}

function kmReminder(c: GarageCarLike, key: "oil" | "service", label: string, last: number | undefined, interval: number, now: number): Reminder {
  if (last === undefined || last === null) {
    return { key, label, status: "unknown", detail: `Log your last ${label.toLowerCase()} to get reminders` };
  }
  const est = estimatedKm(c, now);
  const due = last + interval;
  const left = due - est;
  const days = c.dailyKm > 0 ? Math.round(left / c.dailyKm) : null;
  const dueDate = days !== null ? new Date(now + Math.max(0, days) * DAY).toISOString() : undefined;
  if (left <= 0) return { key, label, status: "overdue", detail: `Due at ${due.toLocaleString()} km — about ${Math.abs(left).toLocaleString()} km overdue`, dueDate, shopCategory: key === "oil" ? "Engine Oil" : undefined };
  return {
    key,
    label,
    status: left <= SOON_KM ? "soon" : "ok",
    detail: `In about ${left.toLocaleString()} km${days !== null ? ` (~${days} days)` : ""}, at ${due.toLocaleString()} km`,
    dueDate,
    shopCategory: key === "oil" ? "Engine Oil" : undefined,
  };
}

function dateReminder(key: "token" | "insurance", label: string, due: string | Date | undefined, now: number): Reminder {
  if (!due) return { key, label, status: "unknown", detail: "Add the due date to get a reminder" };
  const d = new Date(due);
  const days = Math.ceil((d.getTime() - now) / DAY);
  const when = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (days < 0) return { key, label, status: "overdue", detail: `Was due ${when} (${Math.abs(days)} days ago)`, dueDate: d.toISOString() };
  return { key, label, status: days <= SOON_DAYS ? "soon" : "ok", detail: `Due ${when} (in ${days} days)`, dueDate: d.toISOString() };
}

export function reminders(c: GarageCarLike, now = Date.now()): Reminder[] {
  return [
    kmReminder(c, "oil", "Oil change", c.lastOilKm, c.oilIntervalKm, now),
    kmReminder(c, "service", "General service", c.lastServiceKm, c.serviceIntervalKm, now),
    dateReminder("token", "Token tax", c.tokenTaxDue, now),
    dateReminder("insurance", "Insurance renewal", c.insuranceDue, now),
  ];
}

export const needsAttention = (rs: Reminder[]) => rs.filter((r) => r.status === "overdue" || r.status === "soon").length;

/** iCalendar file with one all-day event per dated reminder. */
export function remindersToIcs(title: string, rs: Reminder[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const events = rs
    .filter((r) => r.dueDate)
    .map((r, i) => {
      const day = r.dueDate!.slice(0, 10).replace(/-/g, "");
      return [
        "BEGIN:VEVENT",
        `UID:${day}-${r.key}-${i}@auto-marketplace`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day}`,
        `SUMMARY:${esc(`${r.label} — ${title}`)}`,
        `DESCRIPTION:${esc(r.detail)}`,
        "BEGIN:VALARM",
        "TRIGGER:-P3D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${esc(r.label)}`,
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Auto Marketplace//My Garage//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
}
