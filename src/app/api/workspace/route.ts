import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { requireApiWorkspace } from "@/lib/session";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  logoUrl: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) =>
        v === undefined ||
        v === null ||
        v === "" ||
        v.startsWith("data:image/") ||
        /^https?:\/\//i.test(v),
      { message: "logoUrl must be an image data URL or http(s) URL" },
    ),
  primaryColor: hex.optional(),
  sidebarColor: hex.optional(),
  surfaceColor: hex.optional(),
  radius: z.number().min(0).max(2).optional(),
  showPoweredBy: z.boolean().optional(),
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

  if (body.logoUrl && body.logoUrl.startsWith("data:image/")) {
    // ~750KB raw → keeps logos reasonable in Postgres text
    if (body.logoUrl.length > 1_000_000) {
      return NextResponse.json(
        { error: "Logo too large — use an image under ~700KB" },
        { status: 400 },
      );
    }
  }

  const [updated] = await db
    .update(workspaces)
    .set({
      name: body.name ?? workspace.name,
      logoUrl:
        body.logoUrl === undefined
          ? workspace.logoUrl
          : body.logoUrl || null,
      primaryColor: body.primaryColor ?? workspace.primaryColor,
      sidebarColor: body.sidebarColor ?? workspace.sidebarColor,
      surfaceColor: body.surfaceColor ?? workspace.surfaceColor,
      radius: body.radius ?? workspace.radius,
      showPoweredBy: body.showPoweredBy ?? workspace.showPoweredBy,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id))
    .returning();

  return NextResponse.json({ workspace: updated });
}
