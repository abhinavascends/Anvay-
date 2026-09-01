import Link from "next/link";
import { getSafeUser, getUserRole } from "@/lib/supabase/server";
import { AreaStatus } from "@/components/weather/AreaStatus";
import { Logo } from "@/components/ui/Logo";

const ROLE_ROUTES: Record<string, string> = {
  CITIZEN: "/citizen",
  OPERATOR: "/dashboard",
  ADMIN: "/dashboard",
  FIELD_TEAM: "/team",
  SHELTER_MANAGER: "/shelter-manage",
};

const PERSONAS = [
  {
    href: "/report",
        title: "I'm a Resident",
    desc: "Report an emergency in under a minute — no account needed. Track help live.",
    cta: "Report now",
    accent: true,
  },
  {
    href: "/dashboard",
        title: "Control Room",
    desc: "Live district map, AI-triaged incidents and one-click optimal team dispatch.",
    cta: "Open console",
    accent: false,
  },
  {
    href: "/team",
        title: "Rescue Team",
    desc: "Get dispatched instantly, navigate on-scene and update your mission status.",
    cta: "Mission console",
    accent: false,
  },
  {
    href: "/shelter-manage",
        title: "Shelter Manager",
    desc: "Keep occupancy and supplies current so routing decisions use real data.",
    cta: "Shelter console",
    accent: false,
  },
];

const STEPS = [
  {
        title: "Report",
    text: "Anyone reports via app or SMS with GPS + photo — no signup required.",
  },
  {
        title: "AI Triage",
    text: "Gemini classifies the report; duplicates merge and trust scores rise as neighbors corroborate.",
  },
  {
        title: "Smart Dispatch",
    text: "The allocation engine scores every team on ETA, capability, capacity and availability.",
  },
  {
        title: "Live Tracking",
    text: "Everyone watches the same realtime picture until the incident is resolved.",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getSafeUser();
  const signedIn = !!user;
  const role = signedIn ? await getUserRole(): null;
  const consoleHref = (role && ROLE_ROUTES[role]) || "/login";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={48} />
            <span className="text-base font-bold tracking-tight">RakshaSetu</span>
          </Link>
          {signedIn ? (
            <Link
              href={consoleHref}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
            >
              Open my console →
            </Link>
          ): (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-20">
          {error === "unauthorized" && (
            <div className="mx-auto mb-6 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              That area needs a staff account.{" "}
              <Link href="/register" className="font-semibold underline">
                Register
              </Link>{" "}
              or log in with the right role.
            </div>
          )}
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            One platform for the{" "}
            <span className="text-[var(--color-primary)]">entire response</span>{" "}
            — from first report to resolved.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            RakshaSetu turns citizen reports into prioritized incidents, and
            incidents into optimally assigned rescue teams — live, on a real
            map of your district.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/report"
              className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[var(--color-primary)] px-8 text-lg font-bold text-white shadow-md transition-all hover:bg-[var(--color-primary-dark)] active:scale-[0.99] sm:w-auto"
            >
              Report an Emergency
            </Link>
            <span className="text-xs font-medium text-muted">
              No login needed · takes &lt; 60 seconds
            </span>
          </div>
        </section>

        {/* Live area status (weather + risk) */}
        <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <AreaStatus />
        </section>

        {/* Persona tiles */}
        <section
          aria-label="Choose your view"
          className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4"
        >
          {PERSONAS.map((p) => (
            <Link
              key={p.title}
              href={p.href}
              className={`group flex flex-col rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] ${p.accent
                ? "border-red-200 bg-red-50/60"
: "border-[var(--color-border)] bg-white"
                }`}
            >
                            <h2 className="mt-3 font-bold">{p.title}</h2>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
                {p.desc}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-accent)]">
                {p.cta}
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          ))}
        </section>

        {/* How it works / About */}
        <section className="border-y border-[var(--color-border)] bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              How it works
            </h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl bg-white p-5 shadow-sm">
                  <span className="absolute -top-3 left-5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                                    <h3 className="mt-2 font-bold">{s.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {s.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* About */}
        <section className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">About RakshaSetu</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
            In a disaster, the hardest problems aren&apos;t alerts — SACHET
            already sends those. They&apos;re coordination problems: which of
            the 47 incoming reports matter most, which boat should go where,
            and is that shelter actually full? RakshaSetu answers all three in
            realtime, combining citizen reports, official weather warnings and
            resource inventories into a single operating picture for district
            authorities — with SMS fallback for citizens who can&apos;t install
            anything.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-gray-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <Logo size={40} />
              <b className="text-base">RakshaSetu</b>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Real-Time Disaster Response Coordination &amp; Resource
              Optimization Platform.
            </p>
          </div>
          <div>
            <b className="text-sm">Emergency helplines</b>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              <li>
                <a href="tel:112" className="font-semibold hover:text-foreground">
                  112
                </a>{" "}
                — National Emergency
              </li>
              <li>
                <a href="tel:108" className="font-semibold hover:text-foreground">
                  108
                </a>{" "}
                — Ambulance
              </li>
              <li>
                <a href="tel:1078" className="font-semibold hover:text-foreground">
                  1078
                </a>{" "}
                — Disaster Management (NDMA)
              </li>
            </ul>
          </div>
          <div>
            <b className="text-sm">Quick links</b>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              <li><Link href="/report" className="hover:text-foreground">Report an emergency</Link></li>
              <li><Link href="/register" className="hover:text-foreground">Create an account</Link></li>
              <li><Link href="/dashboard" className="hover:text-foreground">Control room</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
