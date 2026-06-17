import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Plane, MapPin, Clock, Ticket, DoorOpen, CircleDot, ArrowRight, Download, FileText } from "lucide-react";
import logoAsset from "@/assets/emirates-logo.png.asset.json";

type Segment = {
  from: string;
  to: string;
  depart_time?: string;
  arrival_time?: string;
  boarding_at?: string;
  gate_closes_at?: string;
  seating_zone?: string;
};

export const Route = createFileRoute("/track/$code")({
  component: TrackPage,
  head: ({ params }) => {
    const code = params.code?.toUpperCase() ?? "";
    const title = `Track Flight ${code} — Emirates Flight Tracking`;
    const description = `Live status, gate, seat, and itinerary for Emirates flight tracking code ${code}. Enter your code to track your flight in real time.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/track/${params.code}` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: `/track/${params.code}` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: title,
            description,
            url: `/track/${params.code}`,
          }),
        },
      ],
    };
  },
});

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function shortDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}${MONTHS[d.getMonth()]}`;
}
function stripColon(t?: string | null) {
  return (t || "").replace(":", "");
}

function TrackPage() {
  const { code } = Route.useParams();
  const boardingPassRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = `${window.location.origin}/track/${code}`;
    QRCode.toDataURL(url, { margin: 0, width: 240, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [code]);

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

  const handleDownloadImage = async () => {
    if (!boardingPassRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(boardingPassRef.current, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `emirates-boarding-pass-${data?.tracking_code}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!data) return;
    setPrinting(true);
    try {
      await generateBookingPdf(data);
    } finally {
      setPrinting(false);
    }
  };

  const segments: Segment[] = (data?.segments as Segment[]) || [];
  const seg0 = segments[0];

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
            {/* Visible status card */}
            <div className="rounded-3xl border bg-gradient-to-br from-primary to-[var(--color-emirates-dark)] p-8 text-primary-foreground shadow-2xl">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <img src={logoAsset.url} alt="Emirates" crossOrigin="anonymous" className="h-12 w-12 rounded bg-white/10 p-1" />
                  <div>
                    <div className="font-display text-lg font-bold">Emirates</div>
                    <div className="text-[10px] uppercase tracking-[0.25em] opacity-80">Flight status</div>
                  </div>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${data.flight_started ? "bg-green-500/20 text-white" : "bg-white/15"}`}>
                  <CircleDot className="h-3 w-3" />
                  {data.flight_started ? "In flight" : "Scheduled"}
                </div>
              </div>

              <div className="mt-6">
                <div className="font-display text-3xl font-bold">{data.passenger_name}</div>
                <div className="mt-1 text-sm opacity-80">{new Date(data.flight_date).toDateString()}</div>
              </div>

              <div className="mt-8 space-y-5">
                {segments.map((s, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-[10px] uppercase tracking-widest opacity-70">From {s.depart_time ? `· ${s.depart_time}` : ""}</div>
                      <div className="font-display text-2xl font-bold">{s.from}</div>
                    </div>
                    <ArrowRight className="h-6 w-6 opacity-70" />
                    <div className="flex-1 text-right">
                      <div className="text-[10px] uppercase tracking-widest opacity-70">To {s.arrival_time ? `· ${s.arrival_time}` : ""}</div>
                      <div className="font-display text-2xl font-bold">{s.to}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleDownloadImage} disabled={downloading} size="lg" className="flex-1">
                <Download className="mr-1" />
                {downloading ? "Preparing image…" : "Download flight ticket"}
              </Button>
              <Button onClick={handleDownloadPdf} disabled={printing} size="lg" variant="outline" className="flex-1">
                <FileText className="mr-1" />
                {printing ? "Generating PDF…" : "Print flight ticket details"}
              </Button>
            </div>

            {/* Hidden printable boarding pass — styled to match sample */}
            <div className="mt-8 overflow-x-auto">
              <BoardingPass
                ref={boardingPassRef}
                data={data}
                seg={seg0}
                qrDataUrl={qrDataUrl}
              />
            </div>

            {/* Details grid */}
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

const BoardingPass = ({ ref, data, seg, qrDataUrl }: any) => {
  const className = (data.class || "Economy").toUpperCase();
  const flightNo = data.flight_ticket || "—";
  const dateShort = shortDate(data.flight_date);
  const seg0: Segment | undefined = seg;
  const fromIATA = seg0?.from || "—";
  const toIATA = seg0?.to || "—";
  const cityName = (seg0?.to || data.passenger_name || "").toUpperCase();
  const boardingAt = stripColon(seg0?.boarding_at) || stripColon(data.depart_time);
  const gateClosesAt = stripColon(seg0?.gate_closes_at);
  const departure = stripColon(seg0?.depart_time) || stripColon(data.depart_time);
  const seat = data.seat || "—";
  const zone = seg0?.seating_zone || "C";
  const gate = data.gate || "—";

  return (
    <div ref={ref} className="mx-auto bg-white text-black" style={{ width: 980, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div className="flex" style={{ minHeight: 360 }}>
        {/* MAIN STUB */}
        <div className="relative flex-1 p-6">
          {/* top row */}
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center bg-[#d71921]">
              <img src={logoAsset.url} alt="Emirates" crossOrigin="anonymous" className="h-12 w-12 object-contain" />
            </div>
            <div className="text-[36px] font-black leading-none tracking-tight">{className}</div>
            <div className="ml-auto text-right">
              <div className="text-[18px] font-semibold tracking-[0.2em]">BOARDING PASS</div>
            </div>
          </div>

          {/* ref code */}
          <div className="mt-6 text-[13px] tracking-wide">EK-{(data.tracking_code || "").toUpperCase()}</div>

          {/* divider */}
          <div className="mt-3 border-t-2 border-black" />

          {/* city / flight / date row */}
          <div className="mt-4 grid grid-cols-12 items-end gap-4">
            <div className="col-span-5 text-[32px] font-bold leading-none">{cityName}</div>
            <div className="col-span-3 text-[24px] font-bold leading-none">{flightNo}</div>
            <div className="col-span-4 text-[24px] font-bold leading-none">{dateShort}</div>
          </div>

          {/* labels row */}
          <div className="mt-6 grid grid-cols-5 gap-4 text-[11px]">
            <div>Gate</div>
            <div>Boarding at</div>
            <div>Gate closes at</div>
            <div>Seat</div>
            <div>Seating Zone</div>
          </div>
          {/* values row */}
          <div className="mt-1 grid grid-cols-5 gap-4 text-[34px] font-black leading-none">
            <div>{gate}</div>
            <div>{boardingAt || "—"}</div>
            <div>{gateClosesAt || "—"}</div>
            <div>{seat}</div>
            <div>{zone}</div>
          </div>

          <div className="mt-6 border-t-2 border-black" />

          <div className="mt-3 flex justify-between text-[11px]">
            <div>{(data.tracking_code || "").toUpperCase()}-1</div>
            <div>Seq 413</div>
          </div>
        </div>

        {/* perforation */}
        <div className="flex flex-col items-center justify-center px-2" style={{ borderLeft: "2px dashed #999" }} />

        {/* QR / barcode */}
        <div className="flex items-center justify-center p-4" style={{ minWidth: 150 }}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Scan" className="h-32 w-32" />
          ) : (
            <div className="h-32 w-32 bg-black/10" />
          )}
        </div>

        {/* DETACHABLE STUB */}
        <div className="p-6" style={{ width: 280, borderLeft: "2px dashed #999" }}>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center bg-[#d71921]">
              <img src={logoAsset.url} alt="Emirates" crossOrigin="anonymous" className="h-10 w-10 object-contain" />
            </div>
            <div className="text-[22px] font-black leading-none">{className}</div>
          </div>

          <div className="mt-6 flex justify-between text-[18px] font-bold">
            <div>{flightNo}</div>
            <div>{dateShort}</div>
          </div>

          <div className="mt-4 text-[18px] font-bold">{fromIATA} - {toIATA}</div>

          <div className="mt-6 grid grid-cols-3 gap-2 text-[10px]">
            <div>Departure</div>
            <div>Seat</div>
            <div>Seating Zone</div>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-[24px] font-black leading-none">
            <div>{departure || "—"}</div>
            <div>{seat}</div>
            <div>{zone}</div>
          </div>

          <div className="mt-10 text-[11px]">Seq 413</div>
        </div>
      </div>
    </div>
  );
};

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

async function loadImageDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generateBookingPdf(data: any) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  try {
    const logo = await loadImageDataUrl(logoAsset.url);
    doc.addImage(logo, "PNG", margin, y, 50, 50);
  } catch {}

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Emirates", margin + 60, y + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Fly Better", margin + 60, y + 38);

  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.text(`Booked On: ${new Date().toDateString()}`, pageW - margin, y + 22, { align: "right" });

  y += 70;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Booking Acknowledgement", margin, y);
  y += 22;

  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(margin, y, pageW - margin * 2, 32, 4, 4, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 53, 15);
  doc.text(
    "! Please check your terminal and gate information with the airline directly at least 24 hours before departure.",
    margin + 10,
    y + 20,
  );
  doc.setTextColor(0);
  y += 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Flight Details", margin, y);
  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  doc.setFontSize(12);
  doc.text("Departing Flight", margin, y);
  y += 18;

  const segments: Segment[] = (data.segments as Segment[]) || [];
  const flightDate = new Date(data.flight_date).toDateString();

  segments.forEach((seg, idx) => {
    const boxTop = y;
    doc.setDrawColor(220);
    doc.roundedRect(margin, boxTop, pageW - margin * 2, 110, 4, 4, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Emirates Airlines", margin + 12, boxTop + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Flight ${data.flight_ticket || "—"}`, margin + 12, boxTop + 32);
    doc.setTextColor(110);
    doc.text("Nonstop  |  " + (data.class || "Economy"), margin + 12, boxTop + 46);
    doc.setTextColor(0);

    const colY = boxTop + 66;
    const col1 = margin + 12;
    const col2 = margin + (pageW - margin * 2) / 2 - 20;
    const col3 = pageW - margin - 110;

    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(flightDate, col1, colY);
    doc.text(flightDate, col3, colY);
    doc.setTextColor(0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${seg.from} - ${seg.depart_time || data.depart_time || ""}`, col1, colY + 18);
    doc.text(`${seg.to} - ${seg.arrival_time || data.arrival_time || ""}`, col3, colY + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text("Travel Time:", col2, colY + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(data.duration || "—", col2, colY + 22);

    y = boxTop + 120;

    if (idx < segments.length - 1) {
      doc.setDrawColor(220);
      doc.line(margin + 20, y, pageW - margin - 20, y);
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text("Layover", pageW / 2, y + 12, { align: "center" });
      doc.setTextColor(0);
      y += 24;
    }
  });

  y += 20;

  if (y > 680) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Traveler Information", margin, y);
  y += 8;
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  const colWidths = [80, 140, 100, 80, 80];
  const headers = ["E-Ticket", "Passenger Name", "Tracking Code", "Seat", "Gate"];
  let x = margin;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 14, pageW - margin * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  headers.forEach((h, i) => {
    doc.text(h, x + 6, y);
    x += colWidths[i];
  });
  y += 14;

  doc.setFont("helvetica", "normal");
  x = margin;
  const row = [
    "Booked",
    data.passenger_name || "—",
    data.tracking_code || "—",
    data.seat || "—",
    data.gate || "—",
  ];
  row.forEach((c, i) => {
    doc.text(String(c), x + 6, y);
    x += colWidths[i];
  });
  y += 24;

  // Billing — uses amount from DB
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Billing Details (USD)", margin, y);
  y += 8;
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  const amount = Number(data.amount ?? 0);
  const amountStr = `$${amount.toFixed(2)}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const rows: [string, string][] = [
    ["1 Adult Ticket", amountStr],
    ["Subtotal", amountStr],
    ["Flight Total", amountStr],
  ];
  rows.forEach(([k, v]) => {
    doc.text(k, margin, y);
    doc.text(v, pageW - margin, y, { align: "right" });
    y += 16;
  });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Total Charge: ${amountStr}`, margin, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text("All fares are quoted in USD. Some airlines may charge Baggage Fees.", margin, y);

  doc.save(`emirates-booking-${data.tracking_code}.pdf`);
}
