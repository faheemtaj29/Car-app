/** Booking slots shared by the booking form and the server. */
export const BOOKING_SLOTS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"] as const;
export const BOOKING_DAYS_AHEAD = 21;

export const BOOKING_LABEL = {
  test_drive: "Test drive",
  inspection: "Home inspection",
  video_call: "WhatsApp video viewing",
} as const;

/** Karachi time (UTC+5, no DST): today's date and the current hour there. */
export function pkNow(now = Date.now()) {
  const d = new Date(now + 5 * 3_600_000);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

export function bookableDates(now = Date.now()) {
  const out: string[] = [];
  const start = new Date(`${pkNow(now).date}T00:00:00Z`).getTime();
  for (let i = 0; i < BOOKING_DAYS_AHEAD; i++) {
    const d = new Date(start + i * 86_400_000);
    if (d.getUTCDay() !== 0) out.push(d.toISOString().slice(0, 10)); // closed on Sundays
  }
  return out;
}

/** A slot today must be at least an hour away. */
export function slotIsFuture(date: string, slot: string, now = Date.now()) {
  const { date: today, hour } = pkNow(now);
  if (date > today) return true;
  if (date < today) return false;
  return Number(slot.slice(0, 2)) >= hour + 1;
}
