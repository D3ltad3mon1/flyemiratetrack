import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Plus, Trash2, Edit3, X, LogOut } from "lucide-react";
import {
  buildSegmentsPayload,
  CURRENCIES,
  FLIGHT_TYPE_LABEL,
  formatAmount,
  formatFlightDate,
  readFlightMeta,
  readSegments,
  type FlightType,
} from "@/lib/flight-utils";
import {
  COUNTRIES,
  airportLabel,
  findAirportByIata,
  getAirportsByCountry,
} from "@/lib/airports";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Segment = {
  from: string;
  to: string;
  from_country?: string;
  to_country?: string;
  depart_date?: string;
  depart_time?: string;
  arrival_date?: string;
  arrival_time?: string;
  boarding_at?: string;
  gate_closes_at?: string;
  seating_zone?: string;
};
type FlightRow = {
  id: string;
  tracking_code: string;
  passenger_name: string;
  flight_date: string;
  flight_ticket: string | null;
  segments: unknown;
  depart_time: string | null;
  arrival_time: string | null;
  duration: string | null;
  class: string | null;
  seat: string | null;
  gate: string | null;
  flight_started: boolean;
  amount: number | null;
};

const emptySegment: Segment = { from: "", to: "", from_country: "", to_country: "", depart_date: "", depart_time: "", arrival_date: "", arrival_time: "", boarding_at: "", gate_closes_at: "", seating_zone: "" };

const emptyForm = {
  tracking_code: "",
  passenger_name: "",
  flight_date: "",
  flight_ticket: "",
  segments: [{ ...emptySegment }] as Segment[],
  depart_time: "",
  arrival_time: "",
  duration: "",
  class: "",
  seat: "",
  gate: "",
  flight_started: false,
  amount: "",
  flight_type: "human" as FlightType,
  currency: "USD",
};

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else setAuthed(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const { data: flights = [] } = useQuery({
    queryKey: ["admin-flights"],
    enabled: !!authed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flights")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FlightRow[];
    },
  });

  const reset = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (f: FlightRow) => {
    setEditing(f.id);
    const meta = readFlightMeta(f.segments);
    const segs = readSegments(f.segments);
    setForm({
      tracking_code: f.tracking_code,
      passenger_name: f.passenger_name,
      flight_date: f.flight_date,
      flight_ticket: f.flight_ticket ?? "",
      segments: segs.length
        ? segs.map((s) => {
            const seg = { ...emptySegment, ...s };
            // Backfill the country for each airport code so the pickers reopen correctly.
            if (!seg.from_country && seg.from) seg.from_country = findAirportByIata(seg.from)?.country ?? "";
            if (!seg.to_country && seg.to) seg.to_country = findAirportByIata(seg.to)?.country ?? "";
            return seg;
          })
        : [{ ...emptySegment }],
      depart_time: f.depart_time ?? "",
      arrival_time: f.arrival_time ?? "",
      duration: f.duration ?? "",
      class: f.class ?? "",
      seat: f.seat ?? "",
      gate: f.gate ?? "",
      flight_started: f.flight_started,
      amount: f.amount != null ? String(f.amount) : "",
      flight_type: meta.flight_type,
      currency: meta.currency,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateSegment = (i: number, patch: Partial<Segment>) => {
    const segments = [...form.segments];
    segments[i] = { ...segments[i], ...patch };
    setForm({ ...form, segments });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        tracking_code: form.tracking_code.trim(),
        passenger_name: form.passenger_name.trim(),
        flight_date: form.flight_date,
        flight_ticket: form.flight_ticket || null,
        // Flight type + currency travel inside the segments JSONB value
        // (see buildSegmentsPayload) — the flights table has no columns for them.
        segments: buildSegmentsPayload(
          form.segments.filter((s) => s.from || s.to),
          form.flight_type,
          form.currency,
        ) as Json,
        depart_time: form.depart_time || null,
        arrival_time: form.arrival_time || null,
        duration: form.duration || null,
        class: form.class || null,
        seat: form.seat || null,
        gate: form.gate || null,
        flight_started: form.flight_started,
        amount: form.amount ? Number(form.amount) : null,
      };
      if (editing) {
        const { error } = await supabase.from("flights").update(payload).eq("id", editing);
        if (error) throw error;
        toast.success("Flight updated");
      } else {
        const { error } = await supabase.from("flights").insert(payload);
        if (error) throw error;
        toast.success("Flight uploaded");
      }
      reset();
      qc.invalidateQueries({ queryKey: ["admin-flights"] });
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this flight?")) return;
    const { error } = await supabase.from("flights").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-flights"] });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (!authed) return null;

  const humanFlights = flights.filter((f) => readFlightMeta(f.segments).flight_type === "human");
  const animalFlights = flights.filter((f) => readFlightMeta(f.segments).flight_type === "animal");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage flights and tracking codes.</p>
          </div>
          <div className="flex gap-2">
            {!showForm && (
              <button onClick={() => { reset(); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[var(--color-emirates-dark)]">
                <Plus className="h-4 w-4" /> New flight
              </button>
            )}
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={save} className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{editing ? "Edit flight" : "New flight"}</h2>
              <button type="button" onClick={reset} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-6">
              <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Flight type</label>
              <div className="mt-2 flex gap-2">
                {(["human", "animal"] as const).map((v) => {
                  const active = form.flight_type === v;
                  return (
                    <button key={v} type="button" onClick={() => setForm({ ...form, flight_type: v })} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${active ? "bg-primary text-primary-foreground" : "border hover:bg-accent"}`}>
                      {FLIGHT_TYPE_LABEL[v]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Passenger name" value={form.passenger_name} onChange={(v) => setForm({ ...form, passenger_name: v })} required />
              <Field label="Date of flight" type="date" value={form.flight_date} onChange={(v) => setForm({ ...form, flight_date: v })} required />
              <Field label="Tracking code" value={form.tracking_code} onChange={(v) => setForm({ ...form, tracking_code: v.toUpperCase() })} required />
              <Field label="Flight ticket" value={form.flight_ticket} onChange={(v) => setForm({ ...form, flight_ticket: v })} placeholder="e.g. EK210" />
              <Field label="Overall depart time" value={form.depart_time} onChange={(v) => setForm({ ...form, depart_time: v })} placeholder="e.g. 14:30" />
              <Field label="Overall arrival time" value={form.arrival_time} onChange={(v) => setForm({ ...form, arrival_time: v })} placeholder="e.g. 21:45" />
              <Field label="Duration" value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} placeholder="e.g. 7h 15m" />
              <Field label="Class" value={form.class} onChange={(v) => setForm({ ...form, class: v })} placeholder="Economy / Business / First" />
              <Field label="Seat" value={form.seat} onChange={(v) => setForm({ ...form, seat: v })} placeholder="e.g. 45K" />
              <Field label="Gate" value={form.gate} onChange={(v) => setForm({ ...form, gate: v })} placeholder="e.g. A08" />
              <Field label="Amount" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="e.g. 366.00" />
              <SelectField
                label="Currency"
                value={form.currency}
                onChange={(v) => setForm({ ...form, currency: v })}
                options={CURRENCIES.map((c) => ({ value: c.code, label: c.name }))}
              />
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Segments</label>
                <button type="button" onClick={() => setForm({ ...form, segments: [...form.segments, { ...emptySegment }] })} className="text-xs font-semibold text-primary hover:underline">+ Add segment</button>
              </div>
              <div className="space-y-4">
                {form.segments.map((s, i) => (
                  <div key={`${editing ?? "new"}-${i}`} className="rounded-xl border bg-background p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Segment {i + 1}</span>
                      {form.segments.length > 1 && (
                        <button type="button" onClick={() => setForm({ ...form, segments: form.segments.filter((_, j) => j !== i) })} className="rounded-lg border px-2 py-1 text-xs hover:bg-accent inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Remove</button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AirportField
                        label="From"
                        code={s.from}
                        country={s.from_country ?? ""}
                        onCountry={(c) => updateSegment(i, { from_country: c, from: "" })}
                        onCode={(v) => updateSegment(i, { from: v.toUpperCase() })}
                      />
                      <AirportField
                        label="To"
                        code={s.to}
                        country={s.to_country ?? ""}
                        onCountry={(c) => updateSegment(i, { to_country: c, to: "" })}
                        onCode={(v) => updateSegment(i, { to: v.toUpperCase() })}
                      />
                      <Field label="Depart date" type="date" value={s.depart_date ?? ""} onChange={(v) => updateSegment(i, { depart_date: v })} />
                      <Field label="Depart time" value={s.depart_time ?? ""} onChange={(v) => updateSegment(i, { depart_time: v })} placeholder="e.g. 1805" />
                      <Field label="Arrival date" type="date" value={s.arrival_date ?? ""} onChange={(v) => updateSegment(i, { arrival_date: v })} />
                      <Field label="Arrival time" value={s.arrival_time ?? ""} onChange={(v) => updateSegment(i, { arrival_time: v })} placeholder="e.g. 2245" />
                      <Field label="Boarding at" value={s.boarding_at ?? ""} onChange={(v) => updateSegment(i, { boarding_at: v })} placeholder="e.g. 1705" />
                      <Field label="Gate closes at" value={s.gate_closes_at ?? ""} onChange={(v) => updateSegment(i, { gate_closes_at: v })} placeholder="e.g. 1745" />
                      <Field label="Seating zone" value={s.seating_zone ?? ""} onChange={(v) => updateSegment(i, { seating_zone: v })} placeholder="e.g. C" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Flight started</label>
              <div className="flex gap-2">
                {(["yes", "no"] as const).map((v) => {
                  const active = (v === "yes") === form.flight_started;
                  return (
                    <button key={v} type="button" onClick={() => setForm({ ...form, flight_started: v === "yes" })} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${active ? "bg-primary text-primary-foreground" : "border hover:bg-accent"}`}>
                      {v.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 py-2.5 font-semibold text-primary-foreground hover:bg-[var(--color-emirates-dark)] disabled:opacity-60">
                {saving ? "Uploading…" : editing ? "Save changes" : "Upload"}
              </button>
              <button type="button" onClick={reset} className="rounded-lg border px-6 py-2.5 font-medium hover:bg-accent">Cancel</button>
            </div>
          </form>
        )}

        <div className="mt-10">
          <FlightGroup title="Flights for Humans" flights={humanFlights} onEdit={startEdit} onRemove={remove} />
          <FlightGroup title="Flights for Animals" flights={animalFlights} onEdit={startEdit} onRemove={remove} />
        </div>
      </div>
    </div>
  );
}

function FlightGroup({ title, flights, onEdit, onRemove }: {
  title: string;
  flights: FlightRow[];
  onEdit: (f: FlightRow) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold">{title} <span className="text-sm font-normal text-muted-foreground">({flights.length})</span></h2>
      {flights.length === 0 ? (
        <div className="mt-4 rounded-2xl border bg-card p-10 text-center text-muted-foreground">No flights yet.</div>
      ) : (
        <ul className="mt-4 space-y-3">
          {flights.map((f) => {
            const meta = readFlightMeta(f.segments);
            return (
            <li key={f.id} className="flex items-center justify-between rounded-2xl border bg-card p-4">
              <div>
                <div className="font-mono text-sm text-primary">{f.tracking_code}</div>
                <div className="mt-0.5 font-semibold">{f.passenger_name}</div>
                <div className="text-xs text-muted-foreground">
                  {readSegments(f.segments).map((s) => `${s.from}→${s.to}`).join(" • ") || "—"} · {formatFlightDate(f.flight_date)} · {f.flight_started ? "In flight" : "Scheduled"}
                  {f.amount != null && <> · {formatAmount(f.amount, meta.currency)}</>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onEdit(f)} className="rounded-lg border p-2 hover:bg-accent"><Edit3 className="h-4 w-4" /></button>
                <button onClick={() => onRemove(f.id)} className="rounded-lg border p-2 hover:bg-accent"><Trash2 className="h-4 w-4 text-destructive" /></button>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function AirportField({ label, code, country, onCountry, onCode }: {
  label: string;
  code: string;
  country: string;
  onCountry: (country: string) => void;
  onCode: (code: string) => void;
}) {
  const [manual, setManual] = useState(code !== "" && !findAirportByIata(code));
  const airports = country ? getAirportsByCountry(country) : [];
  const resolved = findAirportByIata(code);

  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label} — country</label>
      <select
        value={country}
        onChange={(e) => { setManual(false); onCountry(e.target.value); }}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">Select a country…</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>

      <label className="mt-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">{label} — airport</label>
      {manual ? (
        <div className="mt-1 flex gap-2">
          <input
            value={code}
            placeholder="Type IATA code, e.g. LOS"
            onChange={(e) => onCode(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button type="button" onClick={() => setManual(false)} className="shrink-0 rounded-lg border px-3 text-xs hover:bg-accent">List</button>
        </div>
      ) : (
        <select
          value={code}
          disabled={!country}
          onChange={(e) => {
            if (e.target.value === "__other") setManual(true);
            else onCode(e.target.value);
          }}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
        >
          <option value="">{country ? "Select an airport…" : "Pick a country first"}</option>
          {airports.map((a) => (
            <option key={a.code} value={a.code}>
              {a.name} ({a.code}){a.city ? ` — ${a.city}` : ""}
            </option>
          ))}
          {country && <option value="__other">Other — type the code manually</option>}
        </select>
      )}
      {code && (
        <p className="mt-1 text-xs text-muted-foreground">{resolved ? airportLabel(code) : `Airport code ${code.toUpperCase()}`}</p>
      )}
    </div>
  );
}
