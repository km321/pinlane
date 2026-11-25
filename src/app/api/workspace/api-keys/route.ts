import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { generateApiKey, newId } from "@/lib/ids";
import { requireApiWorkspace } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(80).default("MCP key"),
});

export async function GET() {
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const keys = await db.query.apiKeys.findMany({
    where: and(
      eq(apiKeys.workspaceId, workspace.id),
      isNull(apiKeys.revokedAt),
    ),
    orderBy: [desc(apiKeys.createdAt)],
  });

  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const body = createSchema.parse(await req.json());
  const generated = generateApiKey();

  const [record] = await db
    .insert(apiKeys)
    .values({
      id: newId("key"),
      workspaceId: workspace.id,
      name: body.name,
      keyHash: generated.hash,
      prefix: generated.prefix,
    })
    .returning();

  return NextResponse.json(
    {
      key: {
        id: record.id,
        name: record.name,
        prefix: record.prefix,
        createdAt: record.createdAt,
      },
      secret: generated.key,
    },
    { status: 201 },
  );
}
