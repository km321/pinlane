import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviewInvites } from "@/db/schema";
import { newId, newToken } from "@/lib/ids";
import { getProjectInWorkspace } from "@/lib/tickets";
import { requireApiWorkspace } from "@/lib/session";

const createSchema = z.object({
  label: z.string().min(1).max(120).default("Client review"),
  assignedName: z.string().min(1).max(80).nullable().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
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

  const invites = await db.query.reviewInvites.findMany({
    where: eq(reviewInvites.projectId, id),
    orderBy: [desc(reviewInvites.createdAt)],
  });

  return NextResponse.json({ invites });
}

export async function POST(
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

  const body = createSchema.parse(await req.json());
  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [invite] = await db
    .insert(reviewInvites)
    .values({
      id: newId("inv"),
      projectId: id,
      token: newToken(18),
      label: body.label,
      assignedName: body.assignedName?.trim() || null,
      expiresAt,
    })
    .returning();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return NextResponse.json(
    {
      invite,
      url: `${appUrl}/r/${invite.token}`,
    },
    { status: 201 },
  );
}
