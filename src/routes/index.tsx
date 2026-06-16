import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plane, Search, ShieldCheck, Globe2 } from "lucide-react";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Emirates — Track your flight" },
      { name: "description", content: "Enter your tracking code to view your Emirates flight details." },
    ],
  }),
  component: Index,
});

function Index() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = code.trim();
    if (!v) return;
    navigate({ to: "/track/$code", params: { code: v } });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1200px 600px at 80% -10%, color-mix(in oklab, var(--emirates) 25%, transparent), transparent), linear-gradient(180deg, color-mix(in oklab, var(--emirates) 8%, transparent), transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Plane className="h-3.5 w-3.5" /> Real-time flight tracking
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.05] md:text-6xl">
              Track your journey,<br />
              <span className="text-primary">in the air.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Enter your private tracking code to see your itinerary, gate, seat and live status.
            </p>

            <form onSubmit={onSubmit} className="mt-10">
              <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-xl shadow-primary/5 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3 px-3">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Enter tracking code, e.g. EK-7X4P9"
                    className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground/70"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--color-emirates-dark)]"
                >
                  Track flight
                </button>
              </div>
            </form>
          </div>

          <div className="mt-20 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Plane, t: "Live itinerary", d: "Multi-leg journeys with gate and seat info." },
              { icon: ShieldCheck, t: "Private access", d: "Only travelers with the code can view." },
              { icon: Globe2, t: "Global network", d: "Six continents, one boarding pass." },
            ].map((f, i) => (
              <div key={i} className="rounded-2xl border bg-card/60 p-6 backdrop-blur">
                <f.icon className="h-6 w-6 text-primary" />
                <div className="mt-4 font-semibold">{f.t}</div>
                <div className="mt-1 text-sm text-muted-foreground">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Emirates Flight Tracking
      </footer>
    </div>
  );
}
