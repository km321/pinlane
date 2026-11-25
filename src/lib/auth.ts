import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { isSignupOpen } from "@/lib/signup-gate";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const open = await isSignupOpen();
      if (!open) {
        throw new APIError("FORBIDDEN", {
          message:
            "Signup is locked. This self-hosted Pinlane already has an owner — ask them to log you in or add you.",
        });
      }
    }),
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3456",
    "http://127.0.0.1:3456",
    "http://localhost:3456",
  ],
});

export type Session = typeof auth.$Infer.Session;
