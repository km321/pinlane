import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  boardCards,
  feedbackItems,
  projects,
  reviewInvites,
  user,
  workspaceMembers,
  workspaces,
} from "../src/db/schema";
import { hashApiKey, newId, newToken } from "../src/lib/ids";
import { apiKeys } from "../src/db/schema";

async function main() {
  const email = "demo@pinlane.dev";
  let demoUser = await db.query.user.findFirst({ where: eq(user.email, email) });

  if (!demoUser) {
    console.log(
      "No demo user yet. Sign up in the app first, or use the API after creating an account.",
    );
    console.log("Creating orphan demo workspace data requires an existing user.");
    console.log("Tip: after signup, re-run `npm run db:seed`.");
    process.exit(0);
  }

  let membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, demoUser.id),
  });

  let workspaceId = membership?.workspaceId;
  if (!workspaceId) {
    workspaceId = newId("ws");
    await db.insert(workspaces).values({
      id: workspaceId,
      name: "Demo Agency",
      slug: "demo-agency",
      ownerId: demoUser.id,
      primaryColor: "#E85D4C",
    });
    await db.insert(workspaceMembers).values({
      id: newId("wsm"),
      workspaceId,
      userId: demoUser.id,
      role: "owner",
    });
  }

  const existing = await db.query.projects.findFirst({
    where: eq(projects.workspaceId, workspaceId),
  });
  if (existing) {
    console.log("Seed project already exists:", existing.id);
    process.exit(0);
  }

  const projectId = newId("prj");
  const publicKey = `pk_${newToken(12)}`;
  await db.insert(projects).values({
    id: projectId,
    workspaceId,
    name: "Demo marketing site",
    siteUrl: "https://example.com",
    publicKey,
    githubRepo: "example/website",
  });

  await db.insert(reviewInvites).values({
    id: newId("inv"),
    projectId,
    token: newToken(18),
    label: "Demo client review",
  });

  const feedbackId = newId("fb");
  await db.insert(feedbackItems).values({
    id: feedbackId,
    projectId,
    authorType: "guest",
    authorName: "Demo Client",
    pageUrl: "https://example.com/",
    pageTitle: "Example Domain",
    comment: "Can the hero headline be shorter on mobile?",
    highlight: { type: "pin", x: 0.4, y: 0.25, selector: "h1" },
  });

  await db.insert(boardCards).values({
    id: newId("card"),
    projectId,
    feedbackItemId: feedbackId,
    status: "open",
    position: 1,
  });

  const secret = `pln_${newToken(18)}`;
  await db.insert(apiKeys).values({
    id: newId("key"),
    workspaceId,
    name: "Seed MCP key",
    keyHash: hashApiKey(secret),
    prefix: secret.slice(0, 11),
  });

  console.log("Seeded demo project", projectId);
  console.log("publicKey", publicKey);
  console.log("MCP API key (save this):", secret);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
