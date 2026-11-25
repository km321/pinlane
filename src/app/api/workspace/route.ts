import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { requireApiWorkspace } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  logoUrl: z.string().url().nullable().optional().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export async function GET() {
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  return NextResponse.json({ workspace });
}

export async function PATCH(req: Request) {
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const body = updateSchema.parse(await req.json());

  const [updated] = await db
    .update(workspaces)
    .set({
      name: body.name ?? workspace.name,
      logoUrl:
        body.logoUrl === undefined
          ? workspace.logoUrl
          : body.logoUrl || null,
      primaryColor: body.primaryColor ?? workspace.primaryColor,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id))
    .returning();

  return NextResponse.json({ workspace: updated });
}
