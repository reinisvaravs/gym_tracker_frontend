"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CATEGORIES,
  CATEGORY_DOTS,
  CATEGORY_LABELS,
  type Category,
  type TrainingType,
} from "@/lib/training";
import { cn } from "@/lib/utils";

export function AddExercise({
  types,
  onPick,
  onCreateType,
}: {
  types: TrainingType[];
  onPick: (type: TrainingType) => Promise<void>;
  onCreateType: (name: string, category: Category) => Promise<TrainingType>;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState<Category>("weighted_reps");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = filter.trim().toLowerCase();
  const matches = query
    ? types.filter((type) => type.training_name.toLowerCase().includes(query))
    : types;

  const close = () => {
    setOpen(false);
    setFilter("");
    setCreating(false);
    setError(null);
  };

  const run = async (action: () => Promise<void>) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await action();
      close();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Something failed",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        + Add exercise
      </Button>
    );
  }

  return (
    <div className="ring-foreground/10 bg-card flex flex-col gap-3 rounded-xl p-3 ring-1">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          placeholder="Search or name a new exercise"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="flex-1"
        />
        <Button size="sm" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>

      {matches.length > 0 && !creating && (
        <ul className="flex flex-wrap gap-1">
          {matches.map((type) => (
            <li key={type.id}>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(() => onPick(type))}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    CATEGORY_DOTS[type.category],
                  )}
                />
                {type.training_name}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Typing a name that doesn't exist yet is the path to creating one,
          so a new exercise never needs a separate screen. */}
      {query && matches.length === 0 && !creating && (
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-sm">
            No exercise called &ldquo;{filter.trim()}&rdquo;.
          </p>
          <Button size="sm" onClick={() => setCreating(true)}>
            Create it
          </Button>
        </div>
      )}

      {creating && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            What kind of exercise is{" "}
            <span className="font-medium">{filter.trim()}</span>?
          </p>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                size="sm"
                variant={newCategory === category ? "default" : "outline"}
                aria-pressed={newCategory === category}
                onClick={() => setNewCategory(category)}
              >
                {CATEGORY_LABELS[category]}
              </Button>
            ))}
          </div>
          <div>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const created = await onCreateType(
                    filter.trim(),
                    newCategory,
                  );
                  await onPick(created);
                })
              }
            >
              {busy ? "Adding…" : "Add and start logging"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
