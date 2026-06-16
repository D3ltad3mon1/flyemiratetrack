import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Plus, Trash2, Edit3, X, LogOut } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Segment = { from: string; to: string };
type FlightRow = {
  id: string;
  tracking_code: string;
  passenger_name: string;
  flight_date: string;
  flight_ticket: string | null;
  segments: Segment[];
  depart_time: string | null;
  arrival_time: string | null;
  duration: string | null;
  class: string | null;
  seat: string | null;
  gate: string | null;
  flight_started: boolean;
};

const emptyForm = {
  tracking_code: "",
  passenger_name: "",
  flight_date: "",
  flight_ticket: "",
  segments: [{ from: "", to: "" }] as Segment[],
  depart_time: "",
  arrival_time: "",
  duration: "",
  class: "",
  seat: "",
  gate: "",
  flight_started: false,
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
    setForm({
      tracking_code: f.tracking_code,
      passenger_name: f.passenger_name,
      flight_date: f.flight_date,
      flight_ticket: f.flight_ticket ?? "",
      segments: Array.isArray(f.segments) && f.segments.length ? f.segments : [{ from: "", to: "" }],
      depart_time: f.depart_time ?? "",
      arrival_time: f.arrival_time ?? "",
      duration: f.duration ?? "",
      class: f.class ?? "",
      seat: f.seat ?? "",
      gate: f.gate ?? "",
      flight_started: f.flight_started,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        segments: form.segments.filter((s) => s.from || s.to),
        depart_time: form.depart_time || null,
        arrival_time: form.arrival_time || null,
        duration: form.duration || null,
        class: form.class || null,
        seat: form.seat || null,
        gate: form.gate || null,
        flight_started: form.flight_started,
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

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Passenger name" value={form.passenger_name} onChange={(v) => setForm({ ...form, passenger_name: v })} required />
              <Field label="Date of flight" type="date" value={form.flight_date} onChange={(v) => setForm({ ...form, flight_date: v })} required />
              <Field label="Tracking code" value={form.tracking_code} onChange={(v) => setForm({ ...form, tracking_code: v.toUpperCase() })} required />
              <Field label="Flight ticket" value={form.flight_ticket} onChange={(v) => setForm({ ...form, flight_ticket: v })} />
              <Field label="Time of depart" value={form.depart_time} onChange={(v) => setForm({ ...form, depart_time: v })} placeholder="e.g. 14:30" />
              <Field label="Time of arrival" value={form.arrival_time} onChange={(v) => setForm({ ...form, arrival_time: v })} placeholder="e.g. 21:45" />
              <Field label="Duration" value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} placeholder="e.g. 7h 15m" />
              <Field label="Class" value={form.class} onChange={(v) => setForm({ ...form, class: v })} placeholder="Economy / Business / First" />
              <Field label="Seat" value={form.seat} onChange={(v) => setForm({ ...form, seat: v })} />
              <Field label="Gate" value={form.gate} onChange={(v) => setForm({ ...form, gate: v })} />
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Segments (From → To)</label>
                <button type="button" onClick={() => setForm({ ...form, segments: [...form.segments, { from: "", to: "" }] })} className="text-xs font-semibold text-primary hover:underline">+ Add segment</button>
              </div>
              <div className="space-y-2">
                {form.segments.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="flex-1 rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" placeholder="From (e.g. DXB)" value={s.from} onChange={(e) => {
                      const segments = [...form.segments]; segments[i] = { ...s, from: e.target.value }; setForm({ ...form, segments });
                    }} />
                    <input className="flex-1 rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" placeholder="To (e.g. LHR)" value={s.to} onChange={(e) => {
                      const segments = [...form.segments]; segments[i] = { ...s, to: e.target.value }; setForm({ ...form, segments });
                    }} />
                    {form.segments.length > 1 && (
                      <button type="button" onClick={() => setForm({ ...form, segments: form.segments.filter((_, j) => j !== i) })} className="rounded-lg border px-3 hover:bg-accent"><Trash2 className="h-4 w-4" /></button>
                    )}
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
          <h2 className="text-lg font-semibold">All flights</h2>
          {flights.length === 0 ? (
            <div className="mt-4 rounded-2xl border bg-card p-10 text-center text-muted-foreground">No flights yet.</div>
          ) : (
            <ul className="mt-4 space-y-3">
              {flights.map((f) => (
                <li key={f.id} className="flex items-center justify-between rounded-2xl border bg-card p-4">
                  <div>
                    <div className="font-mono text-sm text-primary">{f.tracking_code}</div>
                    <div className="mt-0.5 font-semibold">{f.passenger_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(f.segments as Segment[] | null)?.map((s) => `${s.from}→${s.to}`).join(" • ") || "—"} · {new Date(f.flight_date).toDateString()} · {f.flight_started ? "In flight" : "Scheduled"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(f)} className="rounded-lg border p-2 hover:bg-accent"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => remove(f.id)} className="rounded-lg border p-2 hover:bg-accent"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
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
