import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Plane, MapPin, Clock, Ticket, DoorOpen, CircleDot, ArrowRight } from "lucide-react";

type Segment = { from: string; to: string };

export const Route = createFileRoute("/track/$code")({
  component: TrackPage,
});

function TrackPage() {
  const { code } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["flight", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flights")
        .select("*")
        .ilike("tracking_code", code)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>

        {isLoading && (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center text-muted-foreground">
            Looking up flight…
          </div>
        )}

        {error && (
          <div className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            Failed to load flight.
          </div>
        )}

        {!isLoading && !data && (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center">
            <Plane className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-2xl font-semibold">No flight found</h2>
            <p className="mt-2 text-muted-foreground">
              No flight matches code <span className="font-mono text-foreground">{code}</span>.
            </p>
          </div>
        )}

        {data && (
          <article className="mt-8">
            <div className="rounded-3xl border bg-gradient-to-br from-primary to-[var(--color-emirates-dark)] p-8 text-primary-foreground shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] opacity-80">Boarding pass</div>
                  <div className="mt-2 font-display text-3xl font-bold">{data.passenger_name}</div>
                  <div className="mt-1 text-sm opacity-80">{new Date(data.flight_date).toDateString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.2em] opacity-80">Status</div>
                  <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${data.flight_started ? "bg-green-500/20 text-white" : "bg-white/15"}`}>
                    <CircleDot className="h-3 w-3" />
                    {data.flight_started ? "In flight" : "Scheduled"}
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-5">
                {((data.segments as unknown as Segment[]) || []).map((s, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-[10px] uppercase tracking-widest opacity-70">From</div>
                      <div className="font-display text-2xl font-bold">{s.from}</div>
                    </div>
                    <ArrowRight className="h-6 w-6 opacity-70" />
                    <div className="flex-1 text-right">
                      <div className="text-[10px] uppercase tracking-widest opacity-70">To</div>
                      <div className="font-display text-2xl font-bold">{s.to}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info icon={Clock} label="Departs" value={data.depart_time} />
              <Info icon={Clock} label="Arrives" value={data.arrival_time} />
              <Info icon={Clock} label="Duration" value={data.duration} />
              <Info icon={Ticket} label="Ticket" value={data.flight_ticket} />
              <Info icon={MapPin} label="Class" value={data.class} />
              <Info icon={MapPin} label="Seat" value={data.seat} />
              <Info icon={DoorOpen} label="Gate" value={data.gate} />
              <Info icon={Ticket} label="Tracking code" value={data.tracking_code} mono />
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-2 text-lg font-semibold ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  );
}
