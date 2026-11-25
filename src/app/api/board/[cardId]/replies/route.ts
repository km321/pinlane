import { NextResponse } from "next/server";
import { z } from "zod";
import { addReply, getTicket } from "@/lib/tickets";
import { requireApiWorkspace } from "@/lib/session";

const schema = z.object({
  body: z.string().min(1).max(5000),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await ctx.params;
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { user, workspace } = auth;
  const card = await getTicket(cardId, workspace.id);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { body } = schema.parse(await req.json());
  const reply = await addReply({
    feedbackItemId: card.feedbackItem.id,
    workspaceId: workspace.id,
    authorType: "member",
    authorName: user.name || user.email,
    authorUserId: user.id,
    body,
  });

  return NextResponse.json({ reply }, { status: 201 });
}
