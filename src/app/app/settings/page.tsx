import { and, desc, eq, isNull } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";

export default async function SettingsPage() {
  const { workspace } = await requireWorkspace();
  const keys = await db.query.apiKeys.findMany({
    where: and(
      eq(apiKeys.workspaceId, workspace.id),
      isNull(apiKeys.revokedAt),
    ),
    orderBy: [desc(apiKeys.createdAt)],
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3456";

  return (
    <AppShell title="Branding & API keys">
      <SettingsForm
        initial={{
          name: workspace.name,
          logoUrl: workspace.logoUrl,
          primaryColor: workspace.primaryColor,
          sidebarColor: workspace.sidebarColor,
          surfaceColor: workspace.surfaceColor,
          radius: workspace.radius,
          showPoweredBy: workspace.showPoweredBy,
        }}
        initialKeys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          createdAt: k.createdAt,
        }))}
        appUrl={appUrl}
      />
    </AppShell>
  );
}
