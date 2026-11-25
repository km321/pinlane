"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Branding } from "@/lib/branding";

export function ReviewClaimForm({
  token,
  inviteLabel,
  projectName,
  branding,
}: {
  token: string;
  inviteLabel: string;
  projectName: string;
  branding: Branding;
}) {
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const color = branding.primaryColor;
  const radius = `${branding.radius}rem`;
  const surface = branding.surfaceColor;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/review/${token}/claim`, {
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
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.name}
            className="h-10 w-auto max-w-[180px] object-contain"
          />
        ) : (
          <div className="font-heading text-2xl font-bold" style={{ color }}>
            {branding.name}
          </div>
        )}

        <h1 className="mt-6 text-xl font-semibold">{inviteLabel}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;re reviewing <strong>{projectName}</strong>. Enter your name
          so the team can see who left each pin. Your session keeps pins
          visible after you send them.
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
        {branding.showPoweredBy ? (
          <p className="mt-6 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
            Powered by Pinlane
          </p>
        ) : null}
      </div>
    </div>
  );
}
