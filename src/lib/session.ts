import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createWorkspaceForUser,
  getUserWorkspace,
} from "@/lib/workspace";

export async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user ?? null;
}

export async function requireApiWorkspace() {
  const user = await getSessionUser();
  if (!user) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  let workspace = await getUserWorkspace(user.id);
  if (!workspace) {
    workspace = await createWorkspaceForUser(user.id, user.name || "My agency");
  }
  return { user, workspace };
}
