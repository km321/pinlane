import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  workspaceMembers,
  workspaces,
  type Workspace,
} from "@/db/schema";
import { newId, slugify } from "@/lib/ids";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function getUserWorkspace(userId: string): Promise<Workspace | null> {
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, userId),
    with: { workspace: true },
  });

  return membership?.workspace ?? null;
}

export async function requireWorkspace() {
  const user = await requireUser();
  let workspace = await getUserWorkspace(user.id);
  if (!workspace) {
    workspace = await createWorkspaceForUser(user.id, user.name || "My agency");
  }
  return { user, workspace };
}

export async function createWorkspaceForUser(
  userId: string,
  name: string,
  opts?: { logoUrl?: string; primaryColor?: string },
) {
  const base = slugify(name);
  let slug = base;
  let attempt = 0;
  while (attempt < 8) {
    const existing = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, slug),
    });
    if (!existing) break;
    attempt += 1;
    slug = `${base}-${attempt + 1}`;
  }

  const workspaceId = newId("ws");
  const [workspace] = await db
    .insert(workspaces)
    .values({
      id: workspaceId,
      name,
      slug,
      ownerId: userId,
      logoUrl: opts?.logoUrl,
      primaryColor: opts?.primaryColor ?? "#E85D4C",
    })
    .returning();

  await db.insert(workspaceMembers).values({
    id: newId("wsm"),
    workspaceId,
    userId,
    role: "owner",
  });

  return workspace;
}

export async function assertWorkspaceAccess(
  workspaceId: string,
  userId: string,
) {
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
    ),
  });
  return Boolean(membership);
}
