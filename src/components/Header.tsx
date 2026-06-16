import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/emirates-logo.png.asset.json";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoAsset.url} alt="Emirates" className="h-10 w-10 rounded" />
          <div className="leading-tight">
            <div className="font-display text-xl font-bold tracking-tight">Emirates</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Fly Better</div>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <a
            href="https://flyemirate.lovable.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--color-emirates-dark)]"
          >
            Book a flight
          </a>
        </nav>
      </div>
    </header>
  );
}
