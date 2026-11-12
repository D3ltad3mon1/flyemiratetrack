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
import { EMIRATES_LOGO_DATA_URL } from "@/lib/logo";
import {
  FLIGHT_TYPE_TRAVEL_LABEL,
  formatAmount,
  formatFlightDate,
  readFlightMeta,
  readSegments,
  shortFlightDate,
} from "@/lib/flight-utils";
import { airportLabel, findAirportByIata } from "@/lib/airports";

type Segment = {
  from: string;
  to: string;
  depart_date?: string;
  depart_time?: string;
  arrival_date?: string;
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

function stripColon(t?: string | null) {
  return (t || "").replace(":", "");
}

function TrackPage() {
  const { code } = Route.useParams();
  const boardingPassRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
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
    setDownloadError(null);
    try {
      const canvas = await html2canvas(boardingPassRef.current, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
      });
      // JPG, as the ticket is a photo-style download.
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95),
      );
      if (!blob) throw new Error("Could not create the image file.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `emirates-boarding-pass-${data?.tracking_code}.jpg`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error("Ticket download failed:", err);
      setDownloadError("The ticket could not be downloaded. Please try again.");
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

  const segments: Segment[] = readSegments(data?.segments);
  const seg0 = segments[0];
  const flightMeta = readFlightMeta(data?.segments);
  const flightType = flightMeta.flight_type;
  const typeLabel = FLIGHT_TYPE_TRAVEL_LABEL[flightType];

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
                  <img src={EMIRATES_LOGO_DATA_URL} alt="Emirates" crossOrigin="anonymous" className="h-12 w-12 rounded bg-white/10 p-1" />
                  <div>
                    <div className="font-display text-lg font-bold">Emirates</div>
                    <div className="text-[10px] uppercase tracking-[0.25em] opacity-80">Flight status</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${data.flight_started ? "bg-green-500/20 text-white" : "bg-white/15"}`}>
                    <CircleDot className="h-3 w-3" />
                    {data.flight_started ? "In flight" : "Scheduled"}
                  </div>
                  <div className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                    {typeLabel}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="font-display text-3xl font-bold">{data.passenger_name}</div>
                <div className="mt-1 text-sm opacity-80">{formatFlightDate(data.flight_date)}</div>
              </div>

              <div className="mt-8 space-y-5">
                {segments.map((s, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-[10px] uppercase tracking-widest opacity-70">From {s.depart_time ? `· ${s.depart_time}` : ""}</div>
                      <div className="font-display text-2xl font-bold">{s.from}</div>
                      <div className="text-xs opacity-80">{findAirportByIata(s.from)?.name ?? ""}</div>
                    </div>
                    <ArrowRight className="h-6 w-6 opacity-70" />
                    <div className="flex-1 text-right">
                      <div className="text-[10px] uppercase tracking-widest opacity-70">To {s.arrival_time ? `· ${s.arrival_time}` : ""}</div>
                      <div className="font-display text-2xl font-bold">{s.to}</div>
                      <div className="text-xs opacity-80">{findAirportByIata(s.to)?.name ?? ""}</div>
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
            {downloadError && (
              <p className="mt-3 text-sm font-medium text-destructive">{downloadError}</p>
            )}

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
              <Info icon={Ticket} label="Amount" value={formatAmount(data.amount, flightMeta.currency)} />
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

const BoardingPass = ({ ref, data, seg, qrDataUrl }: any) => {
  // The class field sometimes holds the travel type ("Animal Travel") instead
  // of a cabin class — show a cabin class here; the type has its own badge.
  const rawClass = (data.class || "Economy").toUpperCase();
  const className = rawClass === "HUMAN TRAVEL" || rawClass === "ANIMAL TRAVEL" ? "ECONOMY" : rawClass;
  const flightNo = data.flight_ticket || "—";
  const dateShort = shortFlightDate(data.flight_date);
  const typeLabel = FLIGHT_TYPE_TRAVEL_LABEL[readFlightMeta(data.segments).flight_type];
  const seg0: Segment | undefined = seg;
  const fromIATA = seg0?.from || "—";
  const toIATA = seg0?.to || "—";
  const destCity = (findAirportByIata(seg0?.to ?? "")?.city || seg0?.to || data.passenger_name || "").toUpperCase();
  const boardingAt = stripColon(seg0?.boarding_at) || stripColon(data.depart_time);
  const gateClosesAt = stripColon(seg0?.gate_closes_at);
  const departure = stripColon(seg0?.depart_time) || stripColon(data.depart_time);
  const seat = data.seat || "—";
  const zone = seg0?.seating_zone || "C";
  const gate = data.gate || "—";
  const passengerName = (data.passenger_name || "—").toUpperCase();

  // Text is sized to fit its column: estimate bold Arial at ~0.62em per
  // character and shrink until it fits, so values never run into each other.
  const fitSize = (text: string, base: number, maxW: number) => {
    const est = Math.max(1, text.length) * base * 0.62;
    if (est <= maxW) return base;
    return Math.max(10, Math.floor((base * maxW) / est));
  };
  // One shared size per values row, so the row stays even.
  const mainValues = [gate, boardingAt || "—", gateClosesAt || "—", seat, zone];
  const mainValueSize = Math.min(...mainValues.map((v) => fitSize(v, 22, 80)));
  const stubValues = [departure || "—", seat, zone];
  const stubValueSize = Math.min(...stubValues.map((v) => fitSize(v, 17, 68)));
  const placeSize = fitSize(destCity, 26, 480);
  const nameSize = fitSize(passengerName, 18, 480);

  return (
    <div ref={ref} className="mx-auto bg-white text-black" style={{ width: 980, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div className="flex" style={{ minHeight: 360 }}>
        {/* MAIN STUB */}
        <div className="relative flex-1 p-6">
          {/* top row */}
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center bg-[#d71921]">
              <img src={EMIRATES_LOGO_DATA_URL} alt="Emirates" crossOrigin="anonymous" className="h-12 w-12 object-contain" />
            </div>
            <div className="whitespace-nowrap font-black leading-none tracking-tight" style={{ fontSize: fitSize(className, 28, 260) }}>{className}</div>
            <div className="ml-auto text-right">
              <div className="whitespace-nowrap text-[15px] font-semibold tracking-[0.2em]">BOARDING PASS</div>
              <div className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-neutral-500">{typeLabel.toUpperCase()}</div>
            </div>
          </div>

          {/* ref code */}
          <div className="mt-6 text-[12px] tracking-wide">EK-{(data.tracking_code || "").toUpperCase()}</div>

          {/* divider */}
          <div className="mt-3 border-t-2 border-black" />

          {/* passenger — a key detail, one step above the small print */}
          <div className="mt-4 text-[10px] tracking-[0.2em] text-neutral-500">PASSENGER</div>
          <div className="mt-1 font-bold leading-tight" style={{ fontSize: nameSize }}>{passengerName}</div>

          {/* destination place — the biggest detail on the pass */}
          <div className="mt-4 font-bold leading-none" style={{ fontSize: placeSize }}>{destCity}</div>

          {/* flight / date row */}
          <div className="mt-3 flex items-end gap-6">
            <div className="text-[20px] font-bold leading-none">{flightNo}</div>
            <div className="text-[20px] font-bold leading-none">{dateShort}</div>
          </div>

          {/* labels row */}
          <div className="mt-6 grid grid-cols-5 gap-4 text-[10px]">
            <div>Gate</div>
            <div>Boarding at</div>
            <div>Gate closes at</div>
            <div>Seat</div>
            <div>Seating Zone</div>
          </div>
          {/* values row — one shared size, shrunk to fit the narrow columns */}
          <div className="mt-1 grid grid-cols-5 gap-4 font-black leading-none" style={{ fontSize: mainValueSize }}>
            <div>{gate}</div>
            <div>{boardingAt || "—"}</div>
            <div>{gateClosesAt || "—"}</div>
            <div>{seat}</div>
            <div>{zone}</div>
          </div>

          <div className="mt-6 border-t-2 border-black" />

          <div className="mt-3 flex justify-between text-[10px]">
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
              <img src={EMIRATES_LOGO_DATA_URL} alt="Emirates" crossOrigin="anonymous" className="h-10 w-10 object-contain" />
            </div>
            <div className="text-[18px] font-black leading-none">{className}</div>
          </div>

          <div className="mt-6 flex justify-between text-[15px] font-bold">
            <div>{flightNo}</div>
            <div>{dateShort}</div>
          </div>

          <div className="mt-4 text-[15px] font-bold">{fromIATA} - {toIATA}</div>

          <div className="mt-6 grid grid-cols-3 gap-2 text-[9px]">
            <div>Departure</div>
            <div>Seat</div>
            <div>Seating Zone</div>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 font-black leading-none" style={{ fontSize: stubValueSize }}>
            <div>{departure || "—"}</div>
            <div>{seat}</div>
            <div>{zone}</div>
          </div>

          <div className="mt-10 text-[10px]">Seq 413</div>
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

async function generateBookingPdf(data: any) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Every block of text is wrapped to its column width and every section
  // measures its own height, so nothing ever overlaps or runs off the page.
  const wrap = (text: string, maxWidth: number): string[] =>
    doc.splitTextToSize(text || "—", maxWidth) as string[];
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  try {
    doc.addImage(EMIRATES_LOGO_DATA_URL, "JPEG", margin, y, 50, 50);
  } catch {}

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Emirates", margin + 60, y + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Fly Better", margin + 60, y + 38);

  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.text(`Booked On: ${new Date().toDateString()}`, pageW - margin, y + 22, { align: "right" });

  y += 70;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("Booking Acknowledgement", margin, y);
  y += 22;

  const warning =
    "! Please check your terminal and gate information with the airline directly at least 24 hours before departure.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const warningLines = wrap(warning, contentW - 20);
  const warningH = warningLines.length * 12 + 16;
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(margin, y, contentW, warningH, 4, 4, "FD");
  doc.setTextColor(120, 53, 15);
  warningLines.forEach((line, i) => doc.text(line, margin + 10, y + 19 + i * 12));
  doc.setTextColor(0);
  y += warningH + 18;

  ensureSpace(80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Flight Details", margin, y);
  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  doc.setFontSize(11);
  doc.text("Departing Flight", margin, y);
  y += 18;

  const segments: Segment[] = readSegments(data.segments);
  const flightDate = formatFlightDate(data.flight_date);
  const flightMeta = readFlightMeta(data.segments);
  const flightType = flightMeta.flight_type;
  const typeLabel = FLIGHT_TYPE_TRAVEL_LABEL[flightType];
  const currency = flightMeta.currency;

  segments.forEach((seg, idx) => {
    const fromText = airportLabel(seg.from);
    const toText = airportLabel(seg.to);
    const colW = (contentW - 24 - 40) / 3;
    const col1 = margin + 12;
    const col2 = col1 + colW + 20;
    const col3 = col2 + colW + 20;
    // Measure the route names at the size they are drawn at (11pt bold),
    // or the wrap is computed too small and long names run off the box.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const fromLines = wrap(fromText, colW);
    const toLines = wrap(toText, colW);
    const routeLines = Math.max(fromLines.length, toLines.length);
    // Header (3 lines) + date row + wrapped route names + time row + padding.
    const boxH = 18 + 14 + 14 + 10 + 12 + routeLines * 16 + 16 + 12;

    ensureSpace(boxH + 10);
    const boxTop = y;
    doc.setDrawColor(220);
    doc.roundedRect(margin, boxTop, contentW, boxH, 4, 4, "S");

    let by = boxTop + 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Emirates Airlines", margin + 12, by);
    by += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Flight ${data.flight_ticket || "—"}`, margin + 12, by);
    by += 14;
    doc.setTextColor(110);
    doc.text(`Nonstop  |  ${typeLabel} · ${data.class || "Economy"}`, margin + 12, by);
    doc.setTextColor(0);

    const colY = by + 22;
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(flightDate, col1, colY);
    doc.text(flightDate, col3, colY);
    doc.setTextColor(0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    fromLines.forEach((line, i) => doc.text(line, col1, colY + 18 + i * 16));
    toLines.forEach((line, i) => doc.text(line, col3, colY + 18 + i * 16));

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text("Travel Time:", col2, colY + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(data.duration || "—", col2, colY + 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(seg.depart_time || data.depart_time || "", col1, colY + 18 + routeLines * 16);
    doc.text(seg.arrival_time || data.arrival_time || "", col3, colY + 18 + routeLines * 16);

    y = boxTop + boxH + 10;

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

  y += 10;

  // Traveler Information — passenger name wraps inside its column.
  ensureSpace(90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Traveler Information", margin, y);
  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  const colWidths = [70, 155, 105, 75, 60];
  const headers = ["E-Ticket", "Passenger Name", "Tracking Code", "Seat", "Gate"];
  const rowCells = [
    "Booked",
    data.passenger_name || "—",
    data.tracking_code || "—",
    data.seat || "—",
    data.gate || "—",
  ];
  // Measure the values at the size they are drawn at (9pt normal).
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const rowLines = rowCells.map((c, i) => wrap(String(c), colWidths[i] - 12));
  const rowLinesCount = Math.max(...rowLines.map((l) => l.length));

  ensureSpace(rowLinesCount * 12 + 60);
  // The grey band holds the headers only; the values sit below it on their
  // own lines, so nothing overlaps or gets clipped.
  const bandTop = y - 14;
  const bandH = 22;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, bandTop, contentW, bandH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  let x = margin;
  headers.forEach((h, i) => {
    doc.text(h, x + 6, bandTop + 14);
    x += colWidths[i];
  });

  // Values: one step bigger than the headers, as the key details.
  const dataTop = bandTop + bandH + 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  x = margin;
  rowCells.forEach((c, i) => {
    rowLines[i].forEach((line, j) => doc.text(line, x + 6, dataTop + j * 12));
    x += colWidths[i];
  });
  y = dataTop + (rowLinesCount - 1) * 12 + 18;

  // Billing — in the currency the admin chose for this flight.
  ensureSpace(130);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Billing Details (${currency})`, margin, y);
  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  const amountStr = formatAmount(data.amount, currency);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
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
  doc.setFontSize(11);
  doc.text(`Total Charge: ${amountStr}`, margin, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(`All fares are quoted in ${currency}. Some airlines may charge Baggage Fees.`, margin, y);

  doc.save(`emirates-booking-${data.tracking_code}.pdf`);
}
