/**
 * "What will this car really cost me per month?" and bank-lease comparison.
 * Defaults are indicative only; the admin keeps fuel prices, token-tax bands
 * and bank rates current in Settings → Running costs & bank rates.
 */

export const PROVINCES = ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad"] as const;
export type Province = (typeof PROVINCES)[number];

export type TaxBand = { maxCc: number; amount: number };

export type CostConfig = {
  petrolPerLitre: number;
  dieselPerLitre: number;
  cngPerKg: number;
  electricityPerKwh: number;
  /** Comprehensive insurance, % of car value per year. */
  insurancePct: number;
  bikeInsurancePct: number;
  /** Value lost per year, % of price (shown separately from cash costs). */
  depreciationPct: number;
  /** Annual token tax by engine size, per province (cars). */
  tokenTax: Record<string, TaxBand[]>;
  /** Bikes usually pay lifetime tax at registration; 0 means none yearly. */
  bikeAnnualTax: number;
  updatedNote?: string;
};

export type BankOffer = {
  name: string;
  /** Yearly markup / profit rate, %. */
  markupPct: number;
  minDownPct: number;
  maxYears: number;
  processingFee: number;
  /** Bank-arranged insurance, % of value per year (often mandatory). */
  insurancePct: number;
  /** Oldest car the bank finances, in years since model year. */
  maxCarAge: number;
  islamic: boolean;
};

const BANDS: TaxBand[] = [
  { maxCc: 1000, amount: 2000 },
  { maxCc: 1300, amount: 3500 },
  { maxCc: 1600, amount: 6000 },
  { maxCc: 2000, amount: 10000 },
  { maxCc: 2500, amount: 15000 },
  { maxCc: 100000, amount: 25000 },
];

export const DEFAULT_COSTS: CostConfig = {
  petrolPerLitre: 265,
  dieselPerLitre: 275,
  cngPerKg: 230,
  electricityPerKwh: 60,
  insurancePct: 1.6,
  bikeInsurancePct: 0,
  depreciationPct: 8,
  tokenTax: Object.fromEntries(PROVINCES.map((p) => [p, BANDS])),
  bikeAnnualTax: 0,
  updatedNote: "Sample figures — update fuel prices and tax bands in Settings.",
};

export const DEFAULT_BANKS: BankOffer[] = [
  { name: "Islamic bank (sample)", markupPct: 15.5, minDownPct: 30, maxYears: 5, processingFee: 7500, insurancePct: 1.6, maxCarAge: 5, islamic: true },
  { name: "Conventional bank A (sample)", markupPct: 14.75, minDownPct: 30, maxYears: 5, processingFee: 6000, insurancePct: 1.5, maxCarAge: 7, islamic: false },
  { name: "Conventional bank B (sample)", markupPct: 16, minDownPct: 25, maxYears: 3, processingFee: 5000, insurancePct: 1.4, maxCarAge: 8, islamic: false },
];

/** Monthly instalment for a reducing-balance loan. */
export function emi(principal: number, ratePct: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  const r = ratePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/** km per litre (or per kg CNG) when the listing does not state it. */
export function estimateFuelAverage(kind: "car" | "bike", engineCc?: number, fuel?: string) {
  const cc = engineCc || (kind === "bike" ? 125 : 1300);
  let avg: number;
  if (kind === "bike") avg = cc <= 70 ? 50 : cc <= 125 ? 40 : cc <= 150 ? 35 : cc <= 250 ? 30 : 22;
  else avg = cc <= 800 ? 18 : cc <= 1000 ? 16 : cc <= 1300 ? 14 : cc <= 1600 ? 12 : cc <= 2000 ? 10 : cc <= 3000 ? 8 : 6;
  if (fuel === "Hybrid") avg *= 1.6;
  if (fuel === "Diesel") avg *= 1.2;
  return Math.round(avg * 10) / 10;
}

export function annualTokenTax(cfg: CostConfig, kind: "car" | "bike", province: string, engineCc?: number) {
  if (kind === "bike") return cfg.bikeAnnualTax;
  const bands = cfg.tokenTax[province] || cfg.tokenTax.Punjab || BANDS;
  const cc = engineCc || 1300;
  return [...bands].sort((a, b) => a.maxCc - b.maxCc).find((b) => cc <= b.maxCc)?.amount ?? bands[bands.length - 1]?.amount ?? 0;
}

export type CostInput = {
  kind: "car" | "bike";
  price: number;
  engineCc?: number;
  fuel?: string;
  /** From the listing's specs when known. */
  fuelAverage?: number;
  dailyKm: number;
  province: string;
  finance?: { downPct: number; ratePct: number; years: number } | null;
};

export type CostLine = { key: string; label: string; monthly: number; note?: string };

export function monthlyCost(cfg: CostConfig, input: CostInput) {
  const kmMonth = input.dailyKm * 30;
  const lines: CostLine[] = [];
  const avg = input.fuelAverage || estimateFuelAverage(input.kind, input.engineCc, input.fuel);
  const avgNote = input.fuelAverage ? `${avg} km/l (seller)` : `~${avg} km/l (estimate)`;
  if (input.fuel === "Electric") {
    const kwhPer100 = input.kind === "bike" ? 3 : 16;
    lines.push({ key: "fuel", label: "Charging", monthly: (kmMonth / 100) * kwhPer100 * cfg.electricityPerKwh, note: `${kwhPer100} kWh/100 km` });
  } else {
    const price = input.fuel === "Diesel" ? cfg.dieselPerLitre : input.fuel === "CNG" ? cfg.cngPerKg : cfg.petrolPerLitre;
    lines.push({ key: "fuel", label: "Fuel", monthly: (kmMonth / avg) * price, note: avgNote });
  }
  const cc = input.engineCc || (input.kind === "bike" ? 125 : 1300);
  const perKm = input.kind === "bike" ? 0.8 : cc <= 1000 ? 2.5 : cc <= 1600 ? 3.5 : cc <= 2500 ? 5 : 8;
  lines.push({ key: "maintenance", label: "Maintenance & tyres", monthly: kmMonth * perKm, note: `~Rs ${perKm}/km` });
  lines.push({ key: "tax", label: "Token tax", monthly: annualTokenTax(cfg, input.kind, input.province, input.engineCc) / 12, note: input.province });
  const insPct = input.kind === "bike" ? cfg.bikeInsurancePct : input.finance ? Math.max(cfg.insurancePct, 0) : cfg.insurancePct;
  if (insPct > 0) lines.push({ key: "insurance", label: "Insurance", monthly: (input.price * insPct) / 100 / 12, note: `${insPct}% a year` });
  if (input.finance) {
    const principal = input.price * (1 - input.finance.downPct / 100);
    lines.push({ key: "emi", label: "Bank instalment", monthly: emi(principal, input.finance.ratePct, input.finance.years * 12), note: `${input.finance.years} yrs @ ${input.finance.ratePct}%` });
  }
  const cash = lines.reduce((s, l) => s + l.monthly, 0);
  const depreciation = (input.price * cfg.depreciationPct) / 100 / 12;
  return {
    lines: lines.map((l) => ({ ...l, monthly: Math.round(l.monthly) })),
    total: Math.round(cash),
    perKm: kmMonth ? Math.round((cash - (lines.find((l) => l.key === "emi")?.monthly || 0)) / kmMonth) : 0,
    depreciation: Math.round(depreciation),
    kmMonth,
  };
}

export type LeaseRow = BankOffer & {
  monthly: number;
  totalMarkup: number;
  insuranceMonthly: number;
  upfront: number;
  totalCost: number;
  eligible: boolean;
  reasons: string[];
};

/** Compares every bank for one car, cheapest eligible first. */
export function compareLeases(
  banks: BankOffer[],
  input: { price: number; downPct: number; years: number; salary?: number; carYear: number; dbrPct?: number }
): LeaseRow[] {
  const age = new Date().getFullYear() - input.carYear;
  return banks
    .map((b) => {
      const downPct = Math.max(input.downPct, b.minDownPct);
      const years = Math.min(input.years, b.maxYears);
      const principal = input.price * (1 - downPct / 100);
      const monthly = emi(principal, b.markupPct, years * 12);
      const insuranceMonthly = (input.price * b.insurancePct) / 100 / 12;
      const reasons: string[] = [];
      if (input.downPct < b.minDownPct) reasons.push(`needs ${b.minDownPct}% down`);
      if (input.years > b.maxYears) reasons.push(`max ${b.maxYears} years`);
      if (age > b.maxCarAge) reasons.push(`car older than ${b.maxCarAge} years`);
      if (input.salary && monthly + insuranceMonthly > (input.salary * (input.dbrPct || 40)) / 100) {
        reasons.push(`instalment over ${input.dbrPct || 40}% of salary`);
      }
      return {
        ...b,
        monthly: Math.round(monthly),
        totalMarkup: Math.round(monthly * years * 12 - principal),
        insuranceMonthly: Math.round(insuranceMonthly),
        upfront: Math.round(input.price * (downPct / 100) + b.processingFee),
        totalCost: Math.round(input.price * (downPct / 100) + monthly * years * 12 + b.processingFee + insuranceMonthly * years * 12),
        eligible: reasons.length === 0,
        reasons,
      };
    })
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.totalCost - b.totalCost);
}
