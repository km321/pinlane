"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Branding } from "@/lib/branding";

type ClaimInfo = {
  invite: { label: string; assignedName: string | null };
  project: { name: string; siteUrl: string };
  branding: Branding;
};

export default function ReviewClaimPage() {
  const params = useParams<{ token: string }>();
  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/review/${params.token}/claim`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invite unavailable");
        if (cancelled) return;
        setInfo(data);
        if (data.invite.assignedName) {
          setGuestName(data.invite.assignedName);
          setLoading(true);
          const claim = await fetch(`/api/review/${params.token}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const claimed = await claim.json();
          if (!claim.ok) throw new Error(claimed.error || "Could not start review");
          window.location.href = claimed.redirectUrl;
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/review/${params.token}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start review");
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setLoading(false);
    }
  }

  const color = info?.branding.primaryColor || "#E85D4C";
  const radius = `${info?.branding.radius ?? 0.75}rem`;
  const surface = info?.branding.surfaceColor || "#FFFFFF";

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 py-12"
      style={{
        background: `linear-gradient(160deg, ${surface} 0%, #f3f6f8 55%, ${color}22 100%)`,
      }}
    >
      <div
        className="w-full max-w-md border p-8 shadow-xl"
        style={{
          backgroundColor: surface,
          borderRadius: radius,
          borderColor: "#d5dee5",
        }}
      >
        {info?.branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.branding.logoUrl}
            alt={info.branding.name}
            className="h-10 w-auto max-w-[180px] object-contain"
          />
        ) : (
          <div className="font-heading text-2xl font-bold" style={{ color }}>
            {info?.branding.name || "Pinlane"}
          </div>
        )}

        {error && !info ? (
          <div className="mt-8">
            <h1 className="text-xl font-semibold">Invite unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : !info || info.invite.assignedName ? (
          <p className="mt-8 text-sm text-muted-foreground">
            {loading ? "Opening the live site…" : "Loading review…"}
          </p>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-semibold">{info.invite.label}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;re reviewing <strong>{info.project.name}</strong>. Enter
              your name so the team can see who left each pin. Your session
              keeps pins visible after you send them.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guestName">Your name</Label>
                <Input
                  id="guestName"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Jordan"
                  style={{ borderRadius: `calc(${radius} * 0.8)` }}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                style={{ backgroundColor: color, borderRadius: radius }}
              >
                {loading ? "Opening site…" : "Start reviewing"}
              </Button>
            </form>
            {info.branding.showPoweredBy ? (
              <p className="mt-6 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                Powered by Pinlane
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
