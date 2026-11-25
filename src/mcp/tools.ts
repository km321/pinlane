import { z } from "zod";
import {
  addReply,
  formatTicketForAgent,
  getTicket,
  listProjectsForWorkspace,
  listTickets,
  updateTicket,
} from "@/lib/tickets";
import type { BoardStatus } from "@/db/schema";

export const mcpToolDefinitions = [
  {
    name: "list_projects",
    description:
      "List Pinlane projects in the workspace, including linked GitHub repo/project URLs.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_tickets",
    description:
      "List board tickets (feedback cards). Optionally filter by projectId and status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string" },
        status: {
          type: "string",
          enum: ["open", "in_progress", "done"],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_ticket",
    description:
      "Get a ticket with full feedback context: comment, page URL, highlight/selector, screenshotUrl, openUrl (team deep link that shows the pin on the live page), deepLink, and replies.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ticketId: { type: "string" },
      },
      required: ["ticketId"],
      additionalProperties: false,
    },
  },
  {
    name: "update_ticket",
    description:
      "Update ticket status and/or linked GitHub issue URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ticketId: { type: "string" },
        status: {
          type: "string",
          enum: ["open", "in_progress", "done"],
        },
        githubIssueUrl: { type: ["string", "null"] },
      },
      required: ["ticketId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_reply",
    description: "Add a reply note to a ticket thread (e.g. PR link or fix summary).",
    inputSchema: {
      type: "object" as const,
      properties: {
        ticketId: { type: "string" },
        body: { type: "string" },
      },
      required: ["ticketId", "body"],
      additionalProperties: false,
    },
  },
  {
    name: "get_github_context",
    description:
      "Return the linked GitHub repo/project for a ticket or project, plus a ready-to-use issue/PR body.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ticketId: { type: "string" },
        projectId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];

function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export async function handleMcpTool(
  workspaceId: string,
  name: string,
  args: Record<string, unknown>,
) {
  switch (name) {
    case "list_projects": {
      const projects = await listProjectsForWorkspace(workspaceId);
      return textResult(
        projects.map((p) => ({
          id: p.id,
          name: p.name,
          siteUrl: p.siteUrl,
          githubRepo: p.githubRepo,
          githubProjectUrl: p.githubProjectUrl,
        })),
      );
    }
    case "list_tickets": {
      const parsed = z
        .object({
          projectId: z.string().optional(),
          status: z.enum(["open", "in_progress", "done"]).optional(),
        })
        .parse(args);
      const cards = await listTickets({
        workspaceId,
        projectId: parsed.projectId,
        status: parsed.status as BoardStatus | undefined,
      });
      return textResult(cards.map((c) => formatTicketForAgent(c)));
    }
    case "get_ticket": {
      const { ticketId } = z.object({ ticketId: z.string() }).parse(args);
      const card = await getTicket(ticketId, workspaceId);
      if (!card) return textResult({ error: "Ticket not found" });
      return textResult(formatTicketForAgent(card));
    }
    case "update_ticket": {
      const parsed = z
        .object({
          ticketId: z.string(),
          status: z.enum(["open", "in_progress", "done"]).optional(),
          githubIssueUrl: z.string().url().nullable().optional(),
        })
        .parse(args);
      const updated = await updateTicket(parsed.ticketId, workspaceId, {
        status: parsed.status,
        githubIssueUrl: parsed.githubIssueUrl,
      });
      if (!updated) return textResult({ error: "Ticket not found" });
      return textResult(formatTicketForAgent(updated));
    }
    case "add_reply": {
      const parsed = z
        .object({
          ticketId: z.string(),
          body: z.string().min(1),
        })
        .parse(args);
      const card = await getTicket(parsed.ticketId, workspaceId);
      if (!card) return textResult({ error: "Ticket not found" });
      const reply = await addReply({
        feedbackItemId: card.feedbackItem.id,
        workspaceId,
        authorType: "agent",
        authorName: "Pinlane agent",
        body: parsed.body,
      });
      return textResult(reply);
    }
    case "get_github_context": {
      const parsed = z
        .object({
          ticketId: z.string().optional(),
          projectId: z.string().optional(),
        })
        .parse(args);

      if (parsed.ticketId) {
        const card = await getTicket(parsed.ticketId, workspaceId);
        if (!card) return textResult({ error: "Ticket not found" });
        const fb = card.feedbackItem;
        const selector = fb.highlight.selector
          ? `Selector: \`${fb.highlight.selector}\``
          : `Highlight: ${fb.highlight.type} at (${fb.highlight.x}, ${fb.highlight.y})`;
        return textResult({
          githubRepo: card.project.githubRepo,
          githubProjectUrl: card.project.githubProjectUrl,
          suggestedIssue: {
            title: `[Pinlane] ${fb.comment.slice(0, 72)}`,
            body: [
              `## Feedback`,
              fb.comment,
              ``,
              `## Context`,
              `- Page: ${fb.pageUrl}`,
              fb.pageTitle ? `- Title: ${fb.pageTitle}` : null,
              `- Author: ${fb.authorName}`,
              `- ${selector}`,
              fb.screenshotUrl ? `- Screenshot available on ticket` : null,
              `- Open pin: ${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || ""}/go/${fb.id}`,
              `- Ticket: ${card.id}`,
              card.project.githubProjectUrl
                ? `- GitHub Project: ${card.project.githubProjectUrl}`
                : null,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        });
      }

      if (parsed.projectId) {
        const projects = await listProjectsForWorkspace(workspaceId);
        const project = projects.find((p) => p.id === parsed.projectId);
        if (!project) return textResult({ error: "Project not found" });
        return textResult({
          githubRepo: project.githubRepo,
          githubProjectUrl: project.githubProjectUrl,
          siteUrl: project.siteUrl,
          name: project.name,
        });
      }

      return textResult({ error: "Provide ticketId or projectId" });
    }
    default:
      return textResult({ error: `Unknown tool: ${name}` });
  }
}
