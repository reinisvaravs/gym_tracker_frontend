"use client";

import { useState } from "react";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { SetForm } from "@/components/set-form";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_DOTS,
  formatSet,
  type Session,
  type SetInput,
  type TrainingSet,
} from "@/lib/training";
import { cn } from "@/lib/utils";

export function ExerciseLog({
  session,
  editable,
  previousSet = null,
  onAddSet,
  onEditSet,
  onDeleteSet,
  onDeleteSession,
  onMoveUp,
  onMoveDown,
}: {
  session: Session;
  // Read-only for past days; the log controls only appear where you're logging
  editable: boolean;
  // Last set from the previous workout of this same exercise, used to prefill
  // the very first set of the day — you usually start near where you left off
  previousSet?: TrainingSet | null;
  onAddSet: (sessionId: number, set: SetInput) => Promise<void>;
  onEditSet: (setId: number, set: SetInput) => Promise<void>;
  onDeleteSet: (setId: number) => Promise<void>;
  onDeleteSession: (sessionId: number) => Promise<void>;
  // Both absent when the day holds a single exercise and there is nothing to
  // reorder; one absent at either end of the day, which greys that arrow out.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const prefillSet = session.sets.at(-1) ?? previousSet;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-9 items-center gap-2">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            CATEGORY_DOTS[session.category],
          )}
        />
        <span className="truncate text-base font-semibold">
          {session.training_name}
        </span>

        {editable &&
          (confirmRemove ? (
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <Button
                variant="destructive"
                className="h-9"
                onClick={() => onDeleteSession(session.id)}
              >
                Remove
              </Button>
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => setConfirmRemove(false)}
              >
                Keep
              </Button>
            </span>
          ) : (
            <span className="ml-auto flex shrink-0 items-center">
              {(onMoveUp || onMoveDown) && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    aria-label={`Move ${session.training_name} earlier`}
                    className="text-muted-foreground"
                    disabled={!onMoveUp}
                    onClick={onMoveUp}
                  >
                    <ChevronUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    aria-label={`Move ${session.training_name} later`}
                    className="text-muted-foreground"
                    disabled={!onMoveDown}
                    onClick={onMoveDown}
                  >
                    <ChevronDownIcon />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label={`Remove ${session.training_name}`}
                className="text-muted-foreground"
                onClick={() => setConfirmRemove(true)}
              >
                <TrashIcon />
              </Button>
            </span>
          ))}
      </div>

      {session.sets.length > 0 && (
        <ol className="flex flex-col gap-1">
          {session.sets.map((set) =>
            editingSetId === set.id ? (
              <li key={set.id}>
                <SetForm
                  category={session.category}
                  initialSet={set}
                  submitLabel="Save changes"
                  onCancel={() => setEditingSetId(null)}
                  onSubmit={async (values) => {
                    await onEditSet(set.id, values);
                    setEditingSetId(null);
                  }}
                  onDelete={async () => {
                    await onDeleteSet(set.id);
                    setEditingSetId(null);
                  }}
                />
              </li>
            ) : editable ? (
              // The whole row is the tap target; the pencil signals it
              <li key={set.id}>
                <button
                  type="button"
                  onClick={() => setEditingSetId(set.id)}
                  className="bg-muted/50 active:bg-muted flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-sm tabular-nums transition-colors"
                >
                  <span>{formatSet(set)}</span>
                  <PencilIcon className="text-muted-foreground size-3.5 shrink-0" />
                </button>
              </li>
            ) : (
              <li key={set.id} className="px-1 text-sm tabular-nums">
                {formatSet(set)}
              </li>
            ),
          )}
        </ol>
      )}

      {editable &&
        (adding || session.sets.length === 0 ? (
          <SetForm
            category={session.category}
            initialSet={prefillSet}
            submitLabel="Log set"
            cancelLabel="Done"
            onCancel={
              session.sets.length > 0 ? () => setAdding(false) : undefined
            }
            onSubmit={(values) => onAddSet(session.id, values)}
          />
        ) : (
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => setAdding(true)}
          >
            <PlusIcon className="size-4" />
            Add set
          </Button>
        ))}

      {session.notes && (
        <p className="text-muted-foreground border-l-2 pl-2 text-xs">
          {session.notes}
        </p>
      )}
    </div>
  );
}
