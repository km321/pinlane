/** Bump when shipping embed behavior changes so host sites bust CDN/browser cache. */
export const EMBED_VERSION = "20251125d";

export function embedScriptUrl(appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/embed.js?v=${EMBED_VERSION}`;
}
