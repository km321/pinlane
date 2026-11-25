"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

export type BoardCardView = {
  id: string;
  status: string;
  position: number;
  githubIssueUrl: string | null;
  feedback: {
    id: string;
    authorName: string;
    comment: string;
    pageUrl: string;
    pageTitle: string | null;
    screenshotUrl: string | null;
    openUrl: string;
    highlight: {
      type: string;
      x: number;
      y: number;
      w?: number;
      h?: number;
      selector?: string;
    };
    createdAt: string | Date;
    replies: Array<{
      id: string;
      authorName: string;
      authorType: string;
      body: string;
      createdAt: string | Date;
    }>;
  };
};

const COLUMNS = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
] as const;

function CardItem({
  card,
  onOpen,
}: {
  card: BoardCardView;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { status: card.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className="w-full rounded-xl border bg-white p-3 text-left shadow-sm hover:border-[#e85d4c]/40"
    >
      <p className="text-sm font-medium leading-snug">{card.feedback.comment}</p>
      <p className="mt-2 truncate text-xs text-muted-foreground">
        {card.feedback.authorName} · {card.feedback.pageTitle || "Page"}
      </p>
    </button>
  );
}

export function KanbanBoard({
  projectId,
  initialCards,
}: {
  projectId: string;
  initialCards: BoardCardView[];
}) {
  const [cards, setCards] = useState(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<BoardCardView | null>(null);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byColumn = useMemo(() => {
    const map: Record<string, BoardCardView[]> = {
      open: [],
      in_progress: [],
      done: [],
    };
    for (const card of cards) {
      (map[card.status] ?? map.open).push(card);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [cards]);

  const activeCard = cards.find((c) => c.id === activeId) ?? null;

  async function patchCard(
    cardId: string,
    patch: { status?: string; position?: number },
  ) {
    const res = await fetch(`/api/board/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Update failed");
    const data = await res.json();
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              status: data.ticket.status,
              position: data.ticket.position,
              githubIssueUrl: data.ticket.githubIssueUrl,
            }
          : c,
      ),
    );
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = String(active.id);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    let nextStatus = card.status;
    const overId = String(over.id);
    if (COLUMNS.some((c) => c.id === overId)) {
      nextStatus = overId;
    } else {
      const overCard = cards.find((c) => c.id === overId);
      if (overCard) nextStatus = overCard.status;
    }

    if (nextStatus === card.status) return;

    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, status: nextStatus } : c)),
    );
    try {
      await patchCard(cardId, {
        status: nextStatus,
        position: Date.now() / 1000,
      });
    } catch {
      toast.error("Could not move card");
      setCards(initialCards);
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/board/${selected.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSelected({
        ...selected,
        feedback: {
          ...selected.feedback,
          replies: [...selected.feedback.replies, data.reply],
        },
      });
      setCards((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                feedback: {
                  ...c.feedback,
                  replies: [...c.feedback.replies, data.reply],
                },
              }
            : c,
        ),
      );
      setReply("");
    } catch {
      toast.error("Could not post reply");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              id={col.id}
              className="min-h-[280px] rounded-2xl border bg-white/60 p-3"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <Badge variant="secondary">{byColumn[col.id].length}</Badge>
              </div>
              <SortableContext
                items={byColumn[col.id].map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {byColumn[col.id].length === 0 ? (
                    <p className="px-1 py-8 text-center text-xs text-muted-foreground">
                      Drop cards here
                    </p>
                  ) : (
                    byColumn[col.id].map((card) => (
                      <CardItem
                        key={card.id}
                        card={card}
                        onOpen={() => setSelected(card)}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeCard ? (
            <div className="w-64 rounded-xl border bg-white p-3 shadow-xl">
              <p className="text-sm font-medium">{activeCard.feedback.comment}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Feedback</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 px-1">
                <p className="text-base leading-relaxed">
                  {selected.feedback.comment}
                </p>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>From {selected.feedback.authorName}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      render={
                        <a
                          href={selected.feedback.openUrl}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                      nativeButton={false}
                    >
                      Open pin on site
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      render={
                        <a
                          href={selected.feedback.pageUrl}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                      nativeButton={false}
                    >
                      Page only
                    </Button>
                  </div>
                  {selected.feedback.screenshotUrl ? (
                    <a
                      href={selected.feedback.screenshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selected.feedback.screenshotUrl}
                        alt="Pin context screenshot"
                        className="max-h-56 w-full object-cover object-top"
                      />
                    </a>
                  ) : null}
                  {selected.feedback.highlight.selector && (
                    <p className="font-mono text-xs">
                      {selected.feedback.highlight.selector}
                    </p>
                  )}
                  {selected.githubIssueUrl && (
                    <p>
                      GitHub:{" "}
                      <a
                        href={selected.githubIssueUrl}
                        className="underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        issue
                      </a>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Thread</h4>
                  {selected.feedback.replies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No replies yet.</p>
                  ) : (
                    selected.feedback.replies.map((r) => (
                      <div key={r.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                        <p className="font-medium">
                          {r.authorName}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            · {r.authorType}
                          </span>
                        </p>
                        <p className="mt-1">{r.body}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to the thread…"
                  />
                  <Button onClick={sendReply} disabled={saving || !reply.trim()}>
                    {saving ? "Sending…" : "Post reply"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Project id {projectId} · Card {selected.id}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
