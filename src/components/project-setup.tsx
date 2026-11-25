"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Invite = {
  id: string;
  token: string;
  label: string;
  createdAt: string | Date;
};

export function ProjectSetup({
  projectId,
  publicKey,
  siteUrl,
  githubRepo,
  githubProjectUrl,
  initialInvites,
  appUrl,
}: {
  projectId: string;
  publicKey: string;
  siteUrl: string;
  githubRepo: string | null;
  githubProjectUrl: string | null;
  initialInvites: Invite[];
  appUrl: string;
}) {
  const [invites, setInvites] = useState(initialInvites);
  const [label, setLabel] = useState("Client review");
  const [repo, setRepo] = useState(githubRepo ?? "");
  const [projectUrl, setProjectUrl] = useState(githubProjectUrl ?? "");
  const [saving, setSaving] = useState(false);

  const snippet = `<script src="${appUrl}/embed.js" data-project="${publicKey}" async></script>`;

  async function copy(text: string, msg: string) {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  }

  async function createInvite() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setInvites((prev) => [data.invite, ...prev]);
      await copy(data.url, "Review link copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveGithub() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepo: repo || null,
          githubProjectUrl: projectUrl || null,
        }),
      });
      if (!res.ok) throw new Error("Could not save");
      toast.success("GitHub link saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-heading text-lg font-semibold">Install embed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste this on {siteUrl} (usually before {"</body>"}).
        </p>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-[#0b1f2a] p-4 text-xs text-white">
          {snippet}
        </pre>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => copy(snippet, "Snippet copied")}
        >
          Copy snippet
        </Button>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-heading text-lg font-semibold">Review invites</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clients claim a session and get redirected to the live site.
        </p>
        <div className="mt-4 flex gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Invite label"
          />
          <Button onClick={createInvite} disabled={saving}>
            Create link
          </Button>
        </div>
        <ul className="mt-4 space-y-2">
          {invites.length === 0 ? (
            <li className="text-sm text-muted-foreground">No invites yet.</li>
          ) : (
            invites.map((invite) => {
              const url = `${appUrl}/r/${invite.token}`;
              return (
                <li
                  key={invite.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                >
                  <span className="truncate">{invite.label}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copy(url, "Invite link copied")}
                  >
                    Copy
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="rounded-2xl border bg-white p-5 lg:col-span-2">
        <h2 className="font-heading text-lg font-semibold">GitHub for agents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          MCP tools return this so agents know which repo/project to work in.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="repo">Repository (owner/name)</Label>
            <Input
              id="repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="acme/website"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ghProject">GitHub Project URL</Label>
            <Input
              id="ghProject"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              placeholder="https://github.com/orgs/acme/projects/1"
            />
          </div>
        </div>
        <Button className="mt-4" onClick={saveGithub} disabled={saving}>
          Save GitHub links
        </Button>
      </section>
    </div>
  );
}
