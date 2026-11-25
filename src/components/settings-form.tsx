"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string | Date;
};

export function SettingsForm({
  initial,
  initialKeys,
  appUrl,
}: {
  initial: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
  };
  initialKeys: KeyRow[];
  appUrl: string;
}) {
  const [name, setName] = useState(initial.name);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [keys, setKeys] = useState(initialKeys);
  const [secret, setSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          logoUrl: logoUrl || null,
          primaryColor,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Branding updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function createKey() {
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "MCP key" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setKeys((prev) => [data.key, ...prev]);
      setSecret(data.secret);
      toast.success("API key created — copy it now");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey(id: string) {
    const res = await fetch(`/api/workspace/api-keys/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not revoke key");
      return;
    }
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast.success("Key revoked");
  }

  const mcpConfig = `{
  "mcpServers": {
    "pinlane": {
      "url": "${appUrl}/api/mcp",
      "headers": {
        "Authorization": "Bearer ${secret || "pln_YOUR_KEY"}"
      }
    }
  }
}`;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <form
        onSubmit={saveBranding}
        className="space-y-4 rounded-2xl border bg-white p-5"
      >
        <h2 className="font-heading text-lg font-semibold">Workspace branding</h2>
        <div className="space-y-2">
          <Label htmlFor="ws-name">Name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo">Logo URL</Label>
          <Input
            id="logo"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Primary color</Label>
          <div className="flex gap-2">
            <Input
              id="color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-14 p-1"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          Save branding
        </Button>
      </form>

      <section className="space-y-4 rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">API keys / MCP</h2>
            <p className="text-sm text-muted-foreground">
              Give coding agents access to tickets for this workspace.
            </p>
          </div>
          <Button onClick={createKey} disabled={saving}>
            New key
          </Button>
        </div>

        {secret && (
          <div className="rounded-xl border border-[#e85d4c]/30 bg-[#e85d4c]/5 p-3">
            <p className="text-sm font-medium">Copy this secret once</p>
            <code className="mt-2 block break-all text-xs">{secret}</code>
          </div>
        )}

        <ul className="space-y-2">
          {keys.length === 0 ? (
            <li className="text-sm text-muted-foreground">No active keys.</li>
          ) : (
            keys.map((key) => (
              <li
                key={key.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
              >
                <span>
                  {key.name} · <code>{key.prefix}…</code>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => revokeKey(key.id)}
                >
                  Revoke
                </Button>
              </li>
            ))
          )}
        </ul>

        <div>
          <p className="mb-2 text-sm font-medium">Cursor MCP config</p>
          <pre className="overflow-x-auto rounded-xl bg-[#0b1f2a] p-4 text-xs text-white">
            {mcpConfig}
          </pre>
        </div>
      </section>
    </div>
  );
}
