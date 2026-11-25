"use client";

import { useRef, useState } from "react";
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

type BrandingState = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  sidebarColor: string;
  surfaceColor: string;
  radius: number;
  showPoweredBy: boolean;
};

const RADIUS_PRESETS = [
  { label: "Sharp", value: 0 },
  { label: "Soft", value: 0.5 },
  { label: "Rounded", value: 0.75 },
  { label: "Pill", value: 1.25 },
];

export function SettingsForm({
  initial,
  initialKeys,
  appUrl,
}: {
  initial: BrandingState;
  initialKeys: KeyRow[];
  appUrl: string;
}) {
  const [brand, setBrand] = useState<BrandingState>({
    ...initial,
    logoUrl: initial.logoUrl,
  });
  const [keys, setKeys] = useState(initialKeys);
  const [secret, setSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof BrandingState>(key: K, value: BrandingState[K]) {
    setBrand((prev) => ({ ...prev, [key]: value }));
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 700_000) {
      toast.error("Logo must be under 700KB");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const optimized = await shrinkImageDataUrl(dataUrl, 320);
    update("logoUrl", optimized);
  }

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: brand.name,
          logoUrl: brand.logoUrl || null,
          primaryColor: brand.primaryColor,
          sidebarColor: brand.sidebarColor,
          surfaceColor: brand.surfaceColor,
          radius: brand.radius,
          showPoweredBy: brand.showPoweredBy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Branding updated — portal and widget will use it");
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

  const previewRadius = `${brand.radius}rem`;

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <form
        onSubmit={saveBranding}
        className="space-y-5 rounded-2xl border bg-white p-5"
      >
        <div>
          <h2 className="font-heading text-lg font-semibold">
            Workspace branding
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Rebrands the agency portal, review claim pages, and the embed
            widget.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Brand name</Label>
              <Input
                id="ws-name"
                value={brand.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex flex-wrap items-center gap-3">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logoUrl}
                    alt="Logo preview"
                    className="h-12 w-auto max-w-[160px] rounded-md border object-contain bg-muted/40 p-1"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                    None
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  Upload logo
                </Button>
                {brand.logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => update("logoUrl", null)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WebP, or SVG · under 700KB
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField
                label="Accent"
                value={brand.primaryColor}
                onChange={(v) => update("primaryColor", v)}
              />
              <ColorField
                label="Sidebar"
                value={brand.sidebarColor}
                onChange={(v) => update("sidebarColor", v)}
              />
              <ColorField
                label="Surfaces"
                value={brand.surfaceColor}
                onChange={(v) => update("surfaceColor", v)}
              />
            </div>

            <div className="space-y-2">
              <Label>Corner rounding</Label>
              <div className="flex flex-wrap gap-2">
                {RADIUS_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    size="sm"
                    variant={brand.radius === preset.value ? "default" : "outline"}
                    onClick={() => update("radius", preset.value)}
                    style={
                      brand.radius === preset.value
                        ? { backgroundColor: brand.primaryColor }
                        : undefined
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <Input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={brand.radius}
                onChange={(e) => update("radius", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                {brand.radius.toFixed(2)}rem
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={brand.showPoweredBy}
                onChange={(e) => update("showPoweredBy", e.target.checked)}
              />
              Show “Powered by Pinlane”
            </label>
          </div>

          <div
            className="overflow-hidden border shadow-sm"
            style={{
              borderRadius: previewRadius,
              background: brand.surfaceColor,
            }}
          >
            <div
              className="flex items-center gap-2 px-4 py-3 text-white"
              style={{ background: brand.sidebarColor }}
            >
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logoUrl}
                  alt=""
                  className="h-7 w-auto max-w-[100px] object-contain"
                />
              ) : (
                <span
                  className="flex h-7 w-7 items-center justify-center text-xs font-bold"
                  style={{
                    background: brand.primaryColor,
                    borderRadius: `calc(${previewRadius} * 0.6)`,
                  }}
                >
                  {brand.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="text-sm font-semibold">{brand.name}</span>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm font-medium" style={{ color: "#0b1f2a" }}>
                Live preview
              </p>
              <div
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white"
                style={{
                  background: brand.sidebarColor,
                  borderRadius: `calc(${previewRadius} * 2)`,
                }}
              >
                <span>{brand.name}</span>
                <span
                  className="px-2 py-1 text-white"
                  style={{
                    background: brand.primaryColor,
                    borderRadius: `calc(${previewRadius} * 2)`,
                  }}
                >
                  Comment
                </span>
              </div>
              <button
                type="button"
                className="w-full px-3 py-2 text-sm font-semibold text-white"
                style={{
                  background: brand.primaryColor,
                  borderRadius: previewRadius,
                }}
              >
                Primary action
              </button>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save branding"}
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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          pattern="^#[0-9A-Fa-f]{6}$"
        />
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

async function shrinkImageDataUrl(dataUrl: string, maxEdge: number) {
  if (dataUrl.startsWith("data:image/svg")) return dataUrl;
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  if (scale >= 1 && dataUrl.length < 400_000) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = src;
  });
}
