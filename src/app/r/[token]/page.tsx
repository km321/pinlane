"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ClaimInfo = {
  invite: { label: string };
  project: { name: string; siteUrl: string };
  branding: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
  };
};

export default function ReviewClaimPage() {
  const params = useParams<{ token: string }>();
  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/review/${params.token}/claim`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invite unavailable");
        setInfo(data);
      })
      .catch((err) => setError(err.message));
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

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-white/95 p-8 shadow-xl">
        {info?.branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.branding.logoUrl}
            alt={info.branding.name}
            className="h-10 w-auto"
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
        ) : !info ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading review…</p>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-semibold">{info.invite.label}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;re reviewing <strong>{info.project.name}</strong>. Enter
              your name to open the live site with commenting tools.
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
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                style={{ backgroundColor: color }}
              >
                {loading ? "Opening site…" : "Start reviewing"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
