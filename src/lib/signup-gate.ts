import { count } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";

/**
 * Self-host rule: the first account owns the agency workspace.
 * After that, public signup is locked.
 */
export async function isSignupOpen() {
  const [row] = await db.select({ value: count() }).from(user);
  return (row?.value ?? 0) === 0;
}
