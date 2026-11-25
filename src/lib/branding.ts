import type { CSSProperties } from "react";
import type { Workspace } from "@/db/schema";

export type Branding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  sidebarColor: string;
  surfaceColor: string;
  radius: number;
  showPoweredBy: boolean;
};

export function brandingFromWorkspace(
  workspace: Pick<
    Workspace,
    | "name"
    | "logoUrl"
    | "primaryColor"
    | "sidebarColor"
    | "surfaceColor"
    | "radius"
    | "showPoweredBy"
  > | null
    | undefined,
): Branding {
  return {
    name: workspace?.name ?? "Pinlane",
    logoUrl: workspace?.logoUrl ?? null,
    primaryColor: workspace?.primaryColor ?? "#E85D4C",
    sidebarColor: workspace?.sidebarColor ?? "#0B1F2A",
    surfaceColor: workspace?.surfaceColor ?? "#FFFFFF",
    radius: workspace?.radius ?? 0.75,
    showPoweredBy: workspace?.showPoweredBy ?? true,
  };
}

export function brandingCssVars(branding: Branding): CSSProperties {
  const radius = `${branding.radius}rem`;
  return {
    ["--primary" as string]: branding.primaryColor,
    ["--ring" as string]: branding.primaryColor,
    ["--sidebar-primary" as string]: branding.primaryColor,
    ["--sidebar-ring" as string]: branding.primaryColor,
    ["--sidebar" as string]: branding.sidebarColor,
    ["--sidebar-accent" as string]: mixHex(branding.sidebarColor, "#ffffff", 0.12),
    ["--card" as string]: branding.surfaceColor,
    ["--popover" as string]: branding.surfaceColor,
    ["--radius" as string]: radius,
    ["--brand-primary" as string]: branding.primaryColor,
    ["--brand-sidebar" as string]: branding.sidebarColor,
    ["--brand-surface" as string]: branding.surfaceColor,
  };
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[m(pa[0], pb[0]), m(pa[1], pb[1]), m(pa[2], pb[2])]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function pinOpenPath(feedbackId: string) {
  return `/go/${feedbackId}`;
}

export function buildPinDeepLink(pageUrl: string, feedbackId: string) {
  try {
    const url = new URL(pageUrl);
    url.hash = `pinlane-pin=${feedbackId}`;
    return url.toString();
  } catch {
    return pageUrl;
  }
}
