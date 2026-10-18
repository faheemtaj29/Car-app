/**
 * WhatsApp / SMS notifications — built, OFF until a provider is configured.
 *
 * How to switch it on later:
 *   NOTIFY_PROVIDER=twilio
 *   TWILIO_ACCOUNT_SID=ACxxxxxxx
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_FROM=whatsapp:+14155238886   (or a plain +92 SMS number)
 *   NOTIFY_CHANNEL=whatsapp             (or sms)
 *
 *   -- OR using Jazz / any Pakistani SMS gateway --
 *   NOTIFY_PROVIDER=jazz
 *   JAZZ_SMS_URL=https://sms.jazz.com.pk/...
 *   JAZZ_SMS_USERNAME=...
 *   JAZZ_SMS_PASSWORD=...
 *
 *   -- OR use a plain HTTP webhook (any gateway) --
 *   NOTIFY_PROVIDER=webhook
 *   NOTIFY_WEBHOOK_URL=https://yourgateway.pk/send
 *   NOTIFY_WEBHOOK_TOKEN=secret
 *   (POST body: { to, message })
 *
 * Providers:
 *   off      (default) nothing is sent; all calls are no-ops.
 *   twilio   Twilio SMS or WhatsApp Business API.
 *   jazz     Jazz SMS gateway (Pakistani carrier).
 *   webhook  Any gateway that accepts a JSON POST.
 *   mock     Tests only — logs messages, never sends.
 */

export type NotifyEvent =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_requested"       // seller gets this
  | "token_verified"
  | "token_refunded"
  | "token_rejected"
  | "ad_approved"
  | "ad_rejected"
  | "kyc_approved"
  | "kyc_rejected"
  | "business_approved"
  | "business_rejected"
  | "new_enquiry"             // seller gets a buyer message
  | "offer_received"
  | "offer_accepted"
  | "offer_countered"
  | "offer_declined";

export type NotifyPayload = {
  event: NotifyEvent;
  to: string;           // Pakistani phone: 03001234567 or +923001234567
  name?: string;        // recipient's name for greeting
  /** Key-value pairs to fill the template. */
  vars?: Record<string, string | number>;
};

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------
const TEMPLATES: Record<NotifyEvent, (v: Record<string, string | number>) => string> = {
  booking_confirmed:   (v) => `Salam ${v.name}! Your ${v.type} booking ${v.number} is confirmed for ${v.date} at ${v.slot}. ${v.address ? `Address: ${v.address}` : ""} — AutoMarket`,
  booking_cancelled:   (v) => `AutoMarket: Booking ${v.number} for ${v.date} at ${v.slot} has been cancelled. ${v.reason ? `Reason: ${v.reason}` : ""}`,
  booking_requested:   (v) => `New ${v.type} request for your car. Buyer: ${v.buyerName} (${v.buyerPhone}) — ${v.date} ${v.slot}. Log in to confirm: ${v.link}`,
  token_verified:      (v) => `AutoMarket: Your safe token ${v.number} for ${v.car} (Rs ${v.amount}) has been verified. The car is held for you until ${v.holdUntil}. Reference: ${v.dealNo}`,
  token_refunded:      (v) => `AutoMarket: Token ${v.number} for ${v.car} has been refunded (Rs ${v.amount}). ${v.reason ? `Reason: ${v.reason}` : ""}`,
  token_rejected:      (v) => `AutoMarket: Token ${v.number} for ${v.car} could not be processed. ${v.reason ? `Reason: ${v.reason}` : ""} Contact us for help.`,
  ad_approved:         (v) => `Your ad "${v.title}" is now live on AutoMarket! Share it: ${v.link}`,
  ad_rejected:         (v) => `AutoMarket: Your ad "${v.title}" needs changes before it can be published. ${v.reason ? `Reason: ${v.reason}` : ""} Log in to update it.`,
  kyc_approved:        (v) => `AutoMarket: Your identity has been verified ✓. You can now sell cars and bikes on the platform.`,
  kyc_rejected:        (v) => `AutoMarket: Your identity check needs attention. ${v.reason ? v.reason : "Log in to update your details."}`,
  business_approved:   (v) => `Congratulations ${v.name}! "${v.business}" is approved on AutoMarket. Your certificate is ready to download. ${v.link}`,
  business_rejected:   (v) => `AutoMarket: The registration for "${v.business}" needs changes. ${v.reason ? v.reason : "Log in to update your profile."}`,
  new_enquiry:         (v) => `New message on your ad "${v.title}" from ${v.buyerName}: "${v.message}" — reply at ${v.link}`,
  offer_received:      (v) => `New offer on "${v.title}": Rs ${v.amount} from ${v.buyerName}. Accept, counter or decline at ${v.link}`,
  offer_accepted:      (v) => `Your offer of Rs ${v.amount} for "${v.title}" was accepted! Next step: safe token or direct contact at ${v.link}`,
  offer_countered:     (v) => `"${v.title}" counter-offer: Rs ${v.amount}. Reply at ${v.link}`,
  offer_declined:      (v) => `Your offer for "${v.title}" was declined. You can make another offer or contact the seller at ${v.link}`,
};

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------
interface NotifyProvider {
  readonly name: string;
  send(to: string, message: string): Promise<void>;
}

const offProvider: NotifyProvider = {
  name: "off",
  async send() { /* nothing */ },
};

const mockProvider: NotifyProvider = {
  name: "mock",
  async send(to, message) {
    console.log(`[notify:mock] → ${to}: ${message}`);
  },
};

function normalise(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("92") && d.length === 12) return `+${d}`;
  if (d.startsWith("0") && d.length === 11) return `+92${d.slice(1)}`;
  return `+${d}`;
}

function twilioProvider(): NotifyProvider {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM || process.env.TWILIO_SMS_FROM || "";
  const channel = (process.env.NOTIFY_CHANNEL || "sms").toLowerCase();
  return {
    name: "twilio",
    async send(to, message) {
      const num = normalise(to);
      const toFmt = channel === "whatsapp" ? `whatsapp:${num}` : num;
      const fromFmt = channel === "whatsapp" && !from.startsWith("whatsapp:") ? `whatsapp:${from}` : from;
      const body = new URLSearchParams({ From: fromFmt, To: toFmt, Body: message });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Twilio ${res.status}: ${(err as { message?: string }).message || res.statusText}`);
      }
    },
  };
}

function jazzProvider(): NotifyProvider {
  const url = process.env.JAZZ_SMS_URL!;
  const user = process.env.JAZZ_SMS_USERNAME!;
  const pass = process.env.JAZZ_SMS_PASSWORD!;
  return {
    name: "jazz",
    async send(to, message) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass, to: normalise(to), message }),
      });
      if (!res.ok) throw new Error(`Jazz SMS ${res.status}`);
    },
  };
}

function webhookProvider(): NotifyProvider {
  const url = process.env.NOTIFY_WEBHOOK_URL!;
  const wtoken = process.env.NOTIFY_WEBHOOK_TOKEN || "";
  return {
    name: "webhook",
    async send(to, message) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(wtoken ? { Authorization: `Bearer ${wtoken}` } : {}) },
        body: JSON.stringify({ to: normalise(to), message }),
      });
      if (!res.ok) throw new Error(`Webhook ${res.status}`);
    },
  };
}

function buildProvider(): NotifyProvider {
  const p = (process.env.NOTIFY_PROVIDER || "off").toLowerCase();
  if (p === "twilio") return twilioProvider();
  if (p === "jazz") return jazzProvider();
  if (p === "webhook") return webhookProvider();
  if (p === "mock") return mockProvider;
  return offProvider;
}

const provider = buildProvider();

export const notifyService = {
  /** Fire-and-forget: a failed send must never break the triggering action. */
  send(payload: NotifyPayload) {
    if (provider.name === "off") return;
    const tmpl = TEMPLATES[payload.event];
    const message = tmpl(payload.vars || {});
    provider.send(payload.to, message).catch((e) => console.error(`[notify:${provider.name}] send failed`, e));
  },

  /** Synchronous send (awaited). Use inside tests. */
  async sendAsync(payload: NotifyPayload) {
    const tmpl = TEMPLATES[payload.event];
    const message = tmpl(payload.vars || {});
    await provider.send(payload.to, message);
  },
};
