import {
  pgTable,
  text,
  timestamp,
  boolean,
  real,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#E85D4C"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("workspace_member_unique").on(t.workspaceId, t.userId)],
);

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  prefix: text("prefix").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    siteUrl: text("site_url").notNull(),
    publicKey: text("public_key").notNull().unique(),
    githubRepo: text("github_repo"),
    githubProjectUrl: text("github_project_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("projects_public_key_idx").on(t.publicKey)],
);

export const reviewInvites = pgTable("review_invites", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  label: text("label").notNull().default("Client review"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviewSessions = pgTable(
  "review_sessions",
  {
    id: text("id").primaryKey(),
    inviteId: text("invite_id")
      .notNull()
      .references(() => reviewInvites.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    guestName: text("guest_name").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("review_sessions_token_idx").on(t.token)],
);

export type HighlightPayload = {
  type: "pin" | "rect";
  x: number;
  y: number;
  w?: number;
  h?: number;
  selector?: string;
};

export const feedbackItems = pgTable("feedback_items", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => reviewSessions.id, {
    onDelete: "set null",
  }),
  authorType: text("author_type").notNull().default("guest"),
  authorName: text("author_name").notNull(),
  pageUrl: text("page_url").notNull(),
  pageTitle: text("page_title"),
  comment: text("comment").notNull(),
  highlight: jsonb("highlight").$type<HighlightPayload>().notNull(),
  screenshotUrl: text("screenshot_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const boardCards = pgTable(
  "board_cards",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    feedbackItemId: text("feedback_item_id")
      .notNull()
      .unique()
      .references(() => feedbackItems.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("open"),
    assigneeId: text("assignee_id").references(() => user.id, {
      onDelete: "set null",
    }),
    position: real("position").notNull().default(0),
    githubIssueUrl: text("github_issue_url"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("board_cards_project_status_pos_idx").on(
      t.projectId,
      t.status,
      t.position,
    ),
  ],
);

export const feedbackReplies = pgTable("feedback_replies", {
  id: text("id").primaryKey(),
  feedbackItemId: text("feedback_item_id")
    .notNull()
    .references(() => feedbackItems.id, { onDelete: "cascade" }),
  authorType: text("author_type").notNull(),
  authorName: text("author_name").notNull(),
  authorUserId: text("author_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
  apiKeys: many(apiKeys),
  owner: one(user, {
    fields: [workspaces.ownerId],
    references: [user.id],
  }),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(user, {
      fields: [workspaceMembers.userId],
      references: [user.id],
    }),
  }),
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  invites: many(reviewInvites),
  feedbackItems: many(feedbackItems),
  boardCards: many(boardCards),
}));

export const feedbackItemsRelations = relations(
  feedbackItems,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [feedbackItems.projectId],
      references: [projects.id],
    }),
    session: one(reviewSessions, {
      fields: [feedbackItems.sessionId],
      references: [reviewSessions.id],
    }),
    boardCard: one(boardCards, {
      fields: [feedbackItems.id],
      references: [boardCards.feedbackItemId],
    }),
    replies: many(feedbackReplies),
  }),
);

export const boardCardsRelations = relations(boardCards, ({ one }) => ({
  project: one(projects, {
    fields: [boardCards.projectId],
    references: [projects.id],
  }),
  feedbackItem: one(feedbackItems, {
    fields: [boardCards.feedbackItemId],
    references: [feedbackItems.id],
  }),
}));

export const feedbackRepliesRelations = relations(feedbackReplies, ({ one }) => ({
  feedbackItem: one(feedbackItems, {
    fields: [feedbackReplies.feedbackItemId],
    references: [feedbackItems.id],
  }),
}));

export type BoardStatus = "open" | "in_progress" | "done";
export const BOARD_STATUSES: BoardStatus[] = ["open", "in_progress", "done"];

export type Workspace = typeof workspaces.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type FeedbackItem = typeof feedbackItems.$inferSelect;
export type BoardCard = typeof boardCards.$inferSelect;
export type ReviewInvite = typeof reviewInvites.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
