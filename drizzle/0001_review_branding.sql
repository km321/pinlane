ALTER TABLE "workspaces" ADD COLUMN "sidebar_color" text DEFAULT '#0B1F2A' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "surface_color" text DEFAULT '#FFFFFF' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "radius" real DEFAULT 0.75 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "show_powered_by" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "review_invites" ADD COLUMN "assigned_name" text;
