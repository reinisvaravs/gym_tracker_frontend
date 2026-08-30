"use client";

import { useState } from "react";

import { SetForm } from "@/components/set-form";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_DOTS,
  formatSet,
  type Session,
  type SetInput,
} from "@/lib/training";
import { cn } from "@/lib/utils";

export function ExerciseLog({
  session,
  editable,
  onAddSet,
  onEditSet,
  onDeleteSet,
  onDeleteSession,
}: {
  session: Session;
  // Read-only for past days; the log controls only appear where you're logging
  editable: boolean;
  onAddSet: (sessionId: number, set: SetInput) => Promise<void>;
  onEditSet: (setId: number, set: SetInput) => Promise<void>;
  onDeleteSet: (setId: number) => Promise<void>;
  onDeleteSession: (sessionId: number) => Promise<void>;
}) {
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const lastSet = session.sets.at(-1) ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            CATEGORY_DOTS[session.category],
          )}
        />
        <span className="text-sm font-medium">{session.training_name}</span>

        {editable && (
          <span className="ml-auto flex items-center gap-1">
            {confirmDelete ? (
              <>
                <span className="text-muted-foreground text-xs">Remove?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDeleteSession(session.id)}
                >
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(false)}
                >
                  No
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
              >
                Remove
              </Button>
            )}
          </span>
        )}
      </div>

      {session.sets.length === 0 ? (
        <p className="text-muted-foreground text-xs">No sets yet.</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {session.sets.map((set) =>
            editingSetId === set.id ? (
              <li key={set.id} className="py-1">
                <SetForm
                  category={session.category}
                  initialSet={set}
                  submitLabel="Save"
                  onCancel={() => setEditingSetId(null)}
                  onSubmit={async (values) => {
                    await onEditSet(set.id, values);
                    setEditingSetId(null);
                  }}
                />
              </li>
            ) : (
              <li
                key={set.id}
                className="group/set flex items-center gap-2 text-xs tabular-nums"
              >
                <span>{formatSet(set)}</span>
                {editable && (
                  <span className="flex gap-1 opacity-0 transition-opacity group-hover/set:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground underline"
                      onClick={() => setEditingSetId(set.id)}
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive underline"
                      onClick={() => onDeleteSet(set.id)}
                    >
                      delete
                    </button>
                  </span>
                )}
              </li>
            ),
          )}
        </ol>
      )}

      {editable &&
        (adding || session.sets.length === 0 ? (
          <div className="pt-1">
            <SetForm
              category={session.category}
              // Prefilled from the last set: the next one is usually the same
              initialSet={lastSet}
              submitLabel="Add set"
              onCancel={
                session.sets.length > 0 ? () => setAdding(false) : undefined
              }
              onSubmit={(values) => onAddSet(session.id, values)}
            />
          </div>
        ) : (
          <div>
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              + Add set
            </Button>
          </div>
        ))}

      {session.notes && (
        <p className="text-muted-foreground border-l-2 pl-2 text-xs">
          {session.notes}
        </p>
      )}
    </div>
  );
}
