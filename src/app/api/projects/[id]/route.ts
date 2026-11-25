import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getProjectInWorkspace } from "@/lib/tickets";
import { requireApiWorkspace } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  siteUrl: z.string().url().optional(),
  githubRepo: z.string().max(200).nullable().optional(),
  githubProjectUrl: z
    .string()
    .url()
    .nullable()
    .optional()
    .or(z.literal("")),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const project = await getProjectInWorkspace(id, workspace.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const project = await getProjectInWorkspace(id, workspace.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateSchema.parse(await req.json());
  const [updated] = await db
    .update(projects)
    .set({
      name: body.name ?? project.name,
      siteUrl: body.siteUrl
        ? body.siteUrl.replace(/\/$/, "")
        : project.siteUrl,
      githubRepo:
        body.githubRepo === undefined ? project.githubRepo : body.githubRepo,
      githubProjectUrl:
        body.githubProjectUrl === undefined
          ? project.githubProjectUrl
          : body.githubProjectUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json({ project: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const project = await getProjectInWorkspace(id, workspace.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ ok: true });
}
