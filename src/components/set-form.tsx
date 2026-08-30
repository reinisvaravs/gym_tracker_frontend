"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CATEGORY_FIELDS,
  FIELD_LABELS,
  type Category,
  type SetField,
  type SetInput,
  type TrainingSet,
} from "@/lib/training";

// Inputs are held as strings so a half-typed "1." doesn't get coerced or
// wiped mid-keystroke. Empty means "no value", which the API stores as null.
type Draft = Partial<Record<SetField, string>>;

const toDraft = (set?: TrainingSet | null): Draft => {
  if (!set) {
    return {};
  }
  const draft: Draft = {};
  for (const field of Object.keys(FIELD_LABELS) as SetField[]) {
    const value = set[field];
    if (value !== null && value !== undefined) {
      draft[field] = String(value);
    }
  }
  return draft;
};

const toInput = (draft: Draft, fields: SetField[]): SetInput => {
  const input: SetInput = {};
  for (const field of fields) {
    const raw = draft[field]?.trim();
    input[field] = raw ? Number(raw) : null;
  }
  return input;
};

// Duration is entered as minutes and seconds; the API stores total seconds.
const splitDuration = (draft: Draft) => {
  const total = Number(draft.duration_seconds ?? "");
  if (!Number.isFinite(total) || !draft.duration_seconds) {
    return { minutes: "", seconds: "" };
  }
  return {
    minutes: String(Math.floor(total / 60)),
    seconds: String(total % 60),
  };
};

export function SetForm({
  category,
  initialSet,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  category: Category;
  // An existing set to edit, or the previous set to prefill from — most sets
  // repeat the one before them, so starting from it saves the typing.
  initialSet?: TrainingSet | null;
  submitLabel: string;
  onSubmit: (set: SetInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const fields = CATEGORY_FIELDS[category];
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialSet));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (field: SetField, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const setDurationPart = (part: "minutes" | "seconds", value: string) => {
    const current = splitDuration(draft);
    const next = { ...current, [part]: value };
    const total =
      (Number(next.minutes) || 0) * 60 + (Number(next.seconds) || 0);
    setField("duration_seconds", total > 0 ? String(total) : "");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) {
      return;
    }

    const input = toInput(draft, fields);
    if (fields.every((field) => input[field] === null)) {
      setError("Fill in at least one value");
      return;
    }
    for (const field of fields) {
      const value = input[field];
      if (
        value !== null &&
        value !== undefined &&
        (!Number.isFinite(value) || value < 0)
      ) {
        setError(`${FIELD_LABELS[field]} must be a positive number`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      // The draft is deliberately left alone: most sets repeat the one
      // before, so 60 x 8 three times is three taps of the same button.
      await onSubmit(input);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not save",
      );
    } finally {
      setSaving(false);
    }
  };

  const duration = splitDuration(draft);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        {fields.map((field) =>
          field === "duration_seconds" ? (
            <div key={field} className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">
                {FIELD_LABELS[field]}
              </label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  aria-label="Minutes"
                  placeholder="min"
                  className="w-16"
                  value={duration.minutes}
                  onChange={(event) =>
                    setDurationPart("minutes", event.target.value)
                  }
                />
                <span className="text-muted-foreground text-xs">:</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="59"
                  aria-label="Seconds"
                  placeholder="sec"
                  className="w-16"
                  value={duration.seconds}
                  onChange={(event) =>
                    setDurationPart("seconds", event.target.value)
                  }
                />
              </div>
            </div>
          ) : (
            <div key={field} className="flex flex-col gap-1">
              <label
                htmlFor={`set-${field}`}
                className="text-muted-foreground text-xs"
              >
                {FIELD_LABELS[field]}
              </label>
              <Input
                id={`set-${field}`}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                className="w-24"
                value={draft[field] ?? ""}
                onChange={(event) => setField(field, event.target.value)}
              />
            </div>
          ),
        )}

        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}
    </form>
  );
}
