import { NextResponse } from "next/server";
import { z } from "zod";
import { BOARD_STATUSES } from "@/db/schema";
import {
  formatTicketForAgent,
  getTicket,
  updateTicket,
} from "@/lib/tickets";
import { requireApiWorkspace } from "@/lib/session";

const patchSchema = z.object({
  status: z.enum(["open", "in_progress", "done"]).optional(),
  position: z.number().optional(),
  githubIssueUrl: z.string().url().nullable().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await ctx.params;
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const card = await getTicket(cardId, workspace.id);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ticket: formatTicketForAgent(card) });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await ctx.params;
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const body = patchSchema.parse(await req.json());

  if (body.status && !BOARD_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await updateTicket(cardId, workspace.id, body);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ticket: formatTicketForAgent(updated) });
}
