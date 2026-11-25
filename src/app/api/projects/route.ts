import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { newId, newToken } from "@/lib/ids";
import { requireApiWorkspace } from "@/lib/session";
import { listProjectsForWorkspace } from "@/lib/tickets";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  siteUrl: z.string().url(),
  githubRepo: z.string().max(200).optional().nullable(),
  githubProjectUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export async function GET() {
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const items = await listProjectsForWorkspace(workspace.id);
  return NextResponse.json({ projects: items });
}

export async function POST(req: Request) {
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const body = createSchema.parse(await req.json());

  const [project] = await db
    .insert(projects)
    .values({
      id: newId("prj"),
      workspaceId: workspace.id,
      name: body.name,
      siteUrl: body.siteUrl.replace(/\/$/, ""),
      publicKey: `pk_${newToken(12)}`,
      githubRepo: body.githubRepo || null,
      githubProjectUrl: body.githubProjectUrl || null,
    })
    .returning();

  return NextResponse.json({ project }, { status: 201 });
}
