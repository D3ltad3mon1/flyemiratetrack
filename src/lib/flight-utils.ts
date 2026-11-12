// Shared helpers for the flight tracker.
//
// Dates: flight dates are plain "YYYY-MM-DD" calendar dates. They must NEVER
// be parsed with `new Date("2026-11-12")` — JavaScript reads that as midnight
// UTC, so in timezones west of UTC it displays as the previous day. All
// formatting here works from the date parts only, so the date the admin picks
// is exactly the date everyone sees.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dateParts(iso?: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** "2026-11-12" -> "Thu Nov 12 2026". Timezone-safe: uses UTC parts only. */
export function formatFlightDate(iso?: string | null): string {
  const p = dateParts(iso);
  if (!p) return "";
  const weekday = WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return `${weekday} ${MONTHS[p.m - 1]} ${p.d} ${p.y}`;
}

/** "2026-11-12" -> "12NOV" (boarding-pass style). Timezone-safe. */
export function shortFlightDate(iso?: string | null): string {
  const p = dateParts(iso);
  if (!p) return "";
  return `${String(p.d).padStart(2, "0")}${MONTHS_SHORT[p.m - 1]}`;
}

// ---------------------------------------------------------------------------
// Flight type: humans and animals are tracked separately.
// ---------------------------------------------------------------------------

export type FlightType = "human" | "animal";

export const FLIGHT_TYPE_LABEL: Record<FlightType, string> = {
  human: "Flight for Humans",
  animal: "Flight for Animals",
};

export const FLIGHT_TYPE_TRAVEL_LABEL: Record<FlightType, string> = {
  human: "Human Travel",
  animal: "Animal Travel",
};

export function normalizeFlightType(v: unknown): FlightType {
  return v === "animal" ? "animal" : "human";
}

// ---------------------------------------------------------------------------
// Storage: the flights table has no flight_type / currency columns, and the
// database cannot be changed from here, so the two values travel inside the
// existing `segments` JSONB column: { items: [...], flight_type, currency }.
// Old rows still store a plain array and read back as human / USD.
// ---------------------------------------------------------------------------

export function readSegments(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && Array.isArray((raw as any).items)) {
    return (raw as any).items;
  }
  return [];
}

export function readFlightMeta(raw: unknown): { flight_type: FlightType; currency: string } {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return {
      flight_type: normalizeFlightType((raw as any).flight_type),
      currency: normalizeCurrency((raw as any).currency),
    };
  }
  return { flight_type: "human", currency: "USD" };
}

export function buildSegmentsPayload(items: any[], flight_type: FlightType, currency: string): unknown {
  return { items, flight_type, currency };
}

// ---------------------------------------------------------------------------
// Currency: the admin picks one per flight; amounts are shown in it as-is
// (no exchange-rate conversion — the stored amount is already in that
// currency).
// ---------------------------------------------------------------------------

export type CurrencyCode = string;

export const CURRENCIES: { code: string; name: string }[] = [
  { code: "NGN", name: "Nigerian Naira (₦)" },
  { code: "USD", name: "US Dollar ($)" },
  { code: "EUR", name: "Euro (€)" },
  { code: "GBP", name: "British Pound (£)" },
  { code: "AED", name: "UAE Dirham (د.إ)" },
  { code: "CAD", name: "Canadian Dollar (C$)" },
  { code: "AUD", name: "Australian Dollar (A$)" },
  { code: "CNY", name: "Chinese Yuan (¥)" },
  { code: "JPY", name: "Japanese Yen (¥)" },
  { code: "INR", name: "Indian Rupee (₹)" },
  { code: "ZAR", name: "South African Rand (R)" },
  { code: "KES", name: "Kenyan Shilling (KSh)" },
  { code: "GHS", name: "Ghanaian Cedi (₵)" },
  { code: "XOF", name: "West African CFA Franc" },
  { code: "MAD", name: "Moroccan Dirham (د.م.)" },
  { code: "EGP", name: "Egyptian Pound (E£)" },
];

export function normalizeCurrency(v: unknown): string {
  if (typeof v === "string" && CURRENCIES.some((c) => c.code === v)) return v;
  return "USD";
}

export function formatAmount(amount: number | null | undefined, currency: unknown): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  const code = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(Number(amount));
  } catch {
    return `${code} ${Number(amount).toFixed(2)}`;
  }
}
