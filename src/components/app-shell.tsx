import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

export async function AppShell({
  children,
  title,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}) {
  const { workspace, user } = await requireWorkspace();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-6">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: workspace.primaryColor }}
          >
            {workspace.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="font-heading text-lg font-bold leading-none">
              Pinlane
            </div>
            <div className="mt-1 truncate text-xs text-white/60">
              {workspace.name}
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          <Link
            href="/app"
            className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-sidebar-accent hover:text-white"
          >
            Projects
          </Link>
          <Link
            href="/app/settings"
            className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-sidebar-accent hover:text-white"
          >
            Branding & API keys
          </Link>
        </nav>
        <div className="border-t border-sidebar-border px-4 py-4">
          <p className="truncate text-xs text-white/50">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white/70 px-4 py-3 backdrop-blur md:px-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground md:hidden">
              {workspace.name}
            </p>
            <h1 className="font-heading text-xl font-semibold">
              {title ?? "Projects"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              render={<Link href="/app/settings" />}
            >
              Settings
            </Button>
            {actions}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
