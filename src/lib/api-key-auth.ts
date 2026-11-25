import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, workspaces } from "@/db/schema";
import { hashApiKey } from "@/lib/ids";

export async function authenticateApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const key = authHeader.slice("Bearer ".length).trim();
  if (!key.startsWith("pln_")) {
    return null;
  }

  const keyHash = hashApiKey(key);
  const record = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)),
  });
  if (!record) return null;

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, record.workspaceId),
  });
  if (!workspace) return null;

  return { apiKey: record, workspace };
}
