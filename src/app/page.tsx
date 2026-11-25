import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230b1f2a' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="font-heading text-2xl font-bold tracking-tight text-[#0b1f2a]">
          Pinlane
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" render={<Link href="/login" />}>
            Log in
          </Button>
          <Button render={<Link href="/signup" />}>Start free</Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-6 pb-24 pt-10 md:pt-20">
        <section className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="font-heading text-5xl font-bold leading-[1.05] tracking-tight text-[#0b1f2a] md:text-7xl">
              Pinlane
            </p>
            <h1 className="mt-5 max-w-xl text-2xl font-medium leading-snug text-[#0b1f2a]/90 md:text-3xl">
              Client feedback on the live page — tracked on your board.
            </h1>
            <p className="mt-4 max-w-lg text-base text-muted-foreground md:text-lg">
              Embed one script, send a magic review link, and turn every pin
              into a Kanban card your team (or agents via MCP) can ship against.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" render={<Link href="/signup" />}>
                Open your workspace
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/login" />}>
                I already have an account
              </Button>
            </div>
          </div>

          <div className="relative animate-in fade-in slide-in-from-right-6 duration-1000">
            <div className="overflow-hidden rounded-2xl border border-[#0b1f2a]/10 bg-[#0b1f2a] p-4 shadow-2xl shadow-[#0b1f2a]/20">
              <div className="mb-3 flex items-center gap-2 text-xs text-white/60">
                <span className="h-2.5 w-2.5 rounded-full bg-[#e85d4c]" />
                staging.client-site.com
              </div>
              <div className="relative h-64 overflow-hidden rounded-xl bg-gradient-to-br from-[#1a3342] to-[#0b1f2a]">
                <div className="absolute left-8 top-10 h-3 w-32 rounded bg-white/20" />
                <div className="absolute left-8 top-20 h-2 w-48 rounded bg-white/10" />
                <div className="absolute left-8 top-28 h-2 w-40 rounded bg-white/10" />
                <div className="absolute bottom-8 left-8 h-10 w-28 rounded-full bg-[#e85d4c]" />
                <div className="absolute right-16 top-24 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#e85d4c] text-xs font-bold text-white shadow-lg">
                  1
                </div>
                <div className="absolute right-6 top-36 w-44 rounded-xl bg-white p-3 text-xs text-[#0b1f2a] shadow-xl">
                  Can we make this CTA less buried on mobile?
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-4 hidden w-56 rounded-xl border bg-white p-3 shadow-xl md:block">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Board
              </p>
              <div className="mt-2 space-y-2">
                <div className="rounded-lg bg-[#e85d4c]/10 px-2 py-1.5 text-sm">
                  Open · CTA hierarchy
                </div>
                <div className="rounded-lg bg-[#1f8a70]/10 px-2 py-1.5 text-sm">
                  In progress · Footer links
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-28 grid gap-10 md:grid-cols-3">
          {[
            {
              title: "Share a review link",
              body: "Clients open a magic link, type their name, and land on the live site in review mode — no account required.",
            },
            {
              title: "Pin and highlight",
              body: "Comment pins and drag highlights attach to the page with selectors so your team knows exactly what they meant.",
            },
            {
              title: "Board + MCP",
              body: "Every note becomes a card. Point Cursor at Pinlane MCP to list tickets and work the linked GitHub repo.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="font-heading text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
