"use client";

import { useCallback, useEffect, useState } from "react";

import { PlusIcon, XIcon } from "@/components/icons";
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

// Shown on the category cards so picking one needs no prior knowledge
const CATEGORY_HELP: Record<Category, string> = {
  weighted_reps: "Barbell, dumbbell, machines — weight × reps",
  bodyweight_reps: "Pull-ups, dips, push-ups — reps only",
  cardio: "Running, cycling, rowing — time & distance",
};

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
  const [newCategory, setNewCategory] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = filter.trim().toLowerCase();
  const matches = query
    ? types.filter((type) => type.training_name.toLowerCase().includes(query))
    : types;
  // Offer "create" whenever the typed name isn't already taken — partial
  // matches must not block it, or "Squat" could never exist next to
  // "Front Squat".
  const isNewName =
    query.length > 0 &&
    !types.some((type) => type.training_name.toLowerCase() === query);

  const close = useCallback(() => {
    setOpen(false);
    setFilter("");
    setCreating(false);
    setNewCategory(null);
    setError(null);
  }, []);

  // The sheet owns the screen while open: lock the page scroll behind it
  // and let Escape close it.
  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

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

  return (
    <>
      <Button
        variant="outline"
        className="h-12 w-full rounded-xl border-dashed text-base"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="size-5" />
        Add exercise
      </Button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/50"
            onClick={close}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add exercise"
            className="bg-background ring-foreground/10 absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl pb-[env(safe-area-inset-bottom)] ring-1"
          >
            <div className="bg-muted-foreground/30 mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full" />

            <div className="flex items-center justify-between px-4 pt-2 pb-1">
              <h2 className="font-heading text-base font-semibold">
                {creating ? "New exercise" : "Add exercise"}
              </h2>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Close"
                onClick={close}
              >
                <XIcon />
              </Button>
            </div>

            {!creating ? (
              <>
                <div className="px-4 pb-2">
                  <Input
                    autoFocus
                    placeholder="Search or type a new name…"
                    className="h-11"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-4">
                  {matches.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => onPick(type))}
                      className="hover:bg-muted active:bg-muted flex min-h-12 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          CATEGORY_DOTS[type.category],
                        )}
                      />
                      <span className="truncate">{type.training_name}</span>
                      <PlusIcon className="text-muted-foreground ml-auto size-4 shrink-0" />
                    </button>
                  ))}

                  {isNewName && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setCreating(true)}
                      className="text-primary hover:bg-muted active:bg-muted flex min-h-12 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors"
                    >
                      <PlusIcon className="size-4 shrink-0" />
                      Create &ldquo;{filter.trim()}&rdquo;
                    </button>
                  )}

                  {matches.length === 0 && !isNewName && (
                    <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                      No exercises yet. Type a name to create one.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
                <p className="text-sm">
                  What kind of exercise is{" "}
                  <span className="font-semibold">{filter.trim()}</span>?
                </p>

                <div className="flex flex-col gap-2">
                  {CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={newCategory === category}
                      onClick={() => setNewCategory(category)}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-xl p-3 text-left ring-1 transition-all",
                        newCategory === category
                          ? "ring-primary bg-primary/5 ring-2"
                          : "ring-foreground/10 hover:bg-muted",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            CATEGORY_DOTS[category],
                          )}
                        />
                        {CATEGORY_LABELS[category]}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {CATEGORY_HELP[category]}
                      </span>
                    </button>
                  ))}
                </div>

                <Button
                  className="h-11 w-full"
                  disabled={busy || !newCategory}
                  onClick={() =>
                    newCategory &&
                    run(async () => {
                      const created = await onCreateType(
                        filter.trim(),
                        newCategory,
                      );
                      await onPick(created);
                    })
                  }
                >
                  {busy ? "Adding…" : "Create & start logging"}
                </Button>

                <Button
                  variant="ghost"
                  className="h-10 w-full"
                  onClick={() => setCreating(false)}
                >
                  Back
                </Button>
              </div>
            )}

            {error && (
              <p className="text-destructive px-4 pb-4 text-sm">{error}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
