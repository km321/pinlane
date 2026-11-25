"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
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

type ColumnId = (typeof COLUMNS)[number]["id"];

function isColumnId(value: string): value is ColumnId {
  return COLUMNS.some((c) => c.id === value);
}

function statusLabel(status: string) {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "done":
      return "Done";
    case "open":
    default:
      return "Open";
  }
}

function columnOf(card: BoardCardView): ColumnId {
  return isColumnId(card.status) ? card.status : "open";
}

/** Group cards into columns without duplicating ids. */
function groupByColumn(cards: BoardCardView[]): Record<ColumnId, BoardCardView[]> {
  const map: Record<ColumnId, BoardCardView[]> = {
    open: [],
    in_progress: [],
    done: [],
  };
  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    map[columnOf(card)].push(card);
  }
  for (const col of COLUMNS) {
    map[col.id].sort((a, b) => a.position - b.position);
  }
  return map;
}

function flattenColumns(
  columns: Record<ColumnId, BoardCardView[]>,
): BoardCardView[] {
  const next: BoardCardView[] = [];
  for (const col of COLUMNS) {
    columns[col.id].forEach((card, index) => {
      next.push({ ...card, status: col.id, position: index + 1 });
    });
  }
  return next;
}

function CardItem({
  card,
  onOpen,
}: {
  card: BoardCardView;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", status: card.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border bg-white shadow-sm hover:border-[#e85d4c]/40"
    >
      <div className="flex gap-1 p-2">
        <button
          type="button"
          className="mt-0.5 h-8 w-7 shrink-0 cursor-grab touch-none rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label="Drag card"
          {...attributes}
          {...listeners}
        >
          <span className="block text-center text-sm leading-none">⠿</span>
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 rounded-md p-1 text-left"
          onClick={onOpen}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Badge variant="secondary" className="text-[10px] uppercase">
              {card.feedback.highlight.type}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {statusLabel(card.status)}
            </span>
          </div>
          <p className="text-sm font-medium leading-snug">
            {card.feedback.comment}
          </p>
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {card.feedback.authorName} · {card.feedback.pageTitle || "Page"}
          </p>
          {card.feedback.replies.length > 0 ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {card.feedback.replies.length}{" "}
              {card.feedback.replies.length === 1 ? "reply" : "replies"}
            </p>
          ) : null}
        </button>
      </div>
    </div>
  );
}

function Column({
  id,
  label,
  cards,
  onOpen,
}: {
  id: ColumnId;
  label: string;
  cards: BoardCardView[];
  onOpen: (card: BoardCardView) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: "column", status: id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[320px] flex-col rounded-2xl border bg-white/60 p-3 transition-colors ${
        isOver ? "border-[#e85d4c]/50 bg-[#e85d4c]/5" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{label}</h3>
        <Badge variant="secondary">{cards.length}</Badge>
      </div>
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {cards.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed px-3 py-10 text-center text-xs text-muted-foreground">
              Drop cards here
            </div>
          ) : (
            cards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                onOpen={() => onOpen(card)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  projectId,
  initialCards,
}: {
  projectId: string;
  initialCards: BoardCardView[];
}) {
  const [cards, setCards] = useState(() =>
    flattenColumns(groupByColumn(initialCards)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<BoardCardView | null>(null);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const snapshotRef = useRef<BoardCardView[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const byColumn = useMemo(() => groupByColumn(cards), [cards]);
  const activeCard = activeId
    ? cards.find((c) => c.id === activeId) ?? null
    : null;

  async function persistColumn(list: BoardCardView[], status: ColumnId) {
    await Promise.all(
      list.map((card, index) =>
        fetch(`/api/board/${card.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, position: index + 1 }),
        }).then((res) => {
          if (!res.ok) throw new Error("Update failed");
        }),
      ),
    );
  }

  function findContainer(
    id: string,
    columns: Record<ColumnId, BoardCardView[]>,
  ): ColumnId | null {
    if (isColumnId(id)) return id;
    for (const col of COLUMNS) {
      if (columns[col.id].some((c) => c.id === id)) return col.id;
    }
    return null;
  }

  function onDragStart(event: DragStartEvent) {
    snapshotRef.current = cards;
    setActiveId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const cardId = String(active.id);
    setActiveId(null);

    if (!over) {
      if (snapshotRef.current) setCards(snapshotRef.current);
      snapshotRef.current = null;
      return;
    }

    const overId = String(over.id);
    const columns = groupByColumn(cards);
    const from = findContainer(cardId, columns);
    const to = findContainer(overId, columns);

    if (!from || !to) {
      snapshotRef.current = null;
      return;
    }

    let nextColumns: Record<ColumnId, BoardCardView[]>;

    if (from === to) {
      const original = columns[from];
      const oldIndex = original.findIndex((c) => c.id === cardId);
      let newIndex = original.findIndex((c) => c.id === overId);
      if (isColumnId(overId)) newIndex = original.length - 1;
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        snapshotRef.current = null;
        return;
      }
      nextColumns = {
        ...columns,
        [from]: arrayMove(original, oldIndex, newIndex),
      };
    } else {
      const fromList = columns[from].filter((c) => c.id !== cardId);
      const moved = columns[from].find((c) => c.id === cardId);
      if (!moved) {
        snapshotRef.current = null;
        return;
      }
      const toList = [...columns[to]];
      let insertAt = toList.length;
      if (!isColumnId(overId)) {
        const overIndex = toList.findIndex((c) => c.id === overId);
        if (overIndex >= 0) insertAt = overIndex;
      }
      toList.splice(insertAt, 0, moved);
      nextColumns = {
        ...columns,
        [from]: fromList,
        [to]: toList,
      };
    }

    const nextCards = flattenColumns(nextColumns);
    setCards(nextCards);

    const touched = new Set<ColumnId>([from, to]);
    try {
      await Promise.all(
        [...touched].map((status) =>
          persistColumn(
            nextCards.filter((c) => c.status === status),
            status,
          ),
        ),
      );
      const updated = nextCards.find((c) => c.id === cardId);
      setSelected((prev) =>
        prev && prev.id === cardId && updated
          ? { ...prev, status: updated.status, position: updated.position }
          : prev,
      );
    } catch {
      toast.error("Could not save card move");
      if (snapshotRef.current) setCards(snapshotRef.current);
    } finally {
      snapshotRef.current = null;
    }
  }

  async function changeStatus(cardId: string, status: ColumnId) {
    const snapshot = cards;
    const columns = groupByColumn(cards);
    const from = findContainer(cardId, columns);
    if (!from || from === status) return;

    const fromList = columns[from].filter((c) => c.id !== cardId);
    const moving = columns[from].find((c) => c.id === cardId);
    if (!moving) return;

    const toList = [...columns[status], moving];
    const nextCards = flattenColumns({
      ...columns,
      [from]: fromList,
      [status]: toList,
    });
    setCards(nextCards);
    setSelected((prev) =>
      prev && prev.id === cardId
        ? {
            ...prev,
            status,
            position: toList.length,
          }
        : prev,
    );

    try {
      await Promise.all([
        persistColumn(
          nextCards.filter((c) => c.status === from),
          from,
        ),
        persistColumn(
          nextCards.filter((c) => c.status === status),
          status,
        ),
      ]);
    } catch {
      toast.error("Could not update status");
      setCards(snapshot);
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
      const nextSelected = {
        ...selected,
        feedback: {
          ...selected.feedback,
          replies: [...selected.feedback.replies, data.reply],
        },
      };
      setSelected(nextSelected);
      setCards((prev) =>
        prev.map((c) => (c.id === selected.id ? nextSelected : c)),
      );
      setReply("");
      toast.success("Reply posted");
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
        onDragCancel={() => {
          if (snapshotRef.current) setCards(snapshotRef.current);
          snapshotRef.current = null;
          setActiveId(null);
        }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              label={col.label}
              cards={byColumn[col.id]}
              onOpen={setSelected}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <div className="w-72 rounded-xl border bg-white p-3 shadow-2xl ring-1 ring-black/5">
              <p className="text-sm font-medium leading-snug">
                {activeCard.feedback.comment}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {activeCard.feedback.authorName}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Feedback</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 px-1">
                <p className="text-base leading-relaxed">
                  {selected.feedback.comment}
                </p>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Stage
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COLUMNS.map((col) => (
                      <Button
                        key={col.id}
                        size="sm"
                        variant={
                          selected.status === col.id ? "default" : "outline"
                        }
                        onClick={() => changeStatus(selected.id, col.id)}
                      >
                        {col.label}
                      </Button>
                    ))}
                  </div>
                </div>

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
                    <p className="text-sm text-muted-foreground">
                      No replies yet.
                    </p>
                  ) : (
                    selected.feedback.replies.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg bg-muted/60 p-3 text-sm"
                      >
                        <p className="font-medium">
                          {r.authorName}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ·{" "}
                            {r.authorType === "member" ? "team" : r.authorType}
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
                  <Button
                    onClick={sendReply}
                    disabled={saving || !reply.trim()}
                  >
                    {saving ? "Sending…" : "Post reply"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Project {projectId} · Card {selected.id}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
