"use client";

import { useState } from "react";

import { MinusIcon, PlusIcon } from "@/components/icons";
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

// The two high-frequency fields get big − / + buttons: between sets you are
// tired and usually nudging the previous value, not typing a fresh one.
function Stepper({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: string;
  step: number;
  onChange: (value: string) => void;
}) {
  const nudge = (delta: number) => {
    const current = Number(value) || 0;
    // round to 2dp so 0.1-steps of floating point never show up
    const next = Math.round((current + delta) * 100) / 100;
    onChange(next > 0 ? String(next) : "");
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-muted-foreground text-center text-xs font-medium">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`Decrease ${label}`}
          onClick={() => nudge(-step)}
        >
          <MinusIcon />
        </Button>
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          placeholder="0"
          className="h-11 min-w-0 flex-1 text-center text-base font-semibold tabular-nums"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`Increase ${label}`}
          onClick={() => nudge(step)}
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}

const STEPPER_FIELDS: Partial<Record<SetField, number>> = {
  weight_kg: 2.5,
  reps: 1,
};

export function SetForm({
  category,
  initialSet,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = "Cancel",
  onDelete,
}: {
  category: Category;
  // An existing set to edit, or the previous set to prefill from — most sets
  // repeat the one before them, so starting from it saves the typing.
  initialSet?: TrainingSet | null;
  submitLabel: string;
  onSubmit: (set: SetInput) => Promise<void>;
  onCancel?: () => void;
  cancelLabel?: string;
  // Present only when editing an existing set
  onDelete?: () => Promise<void>;
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

  const handleDelete = async () => {
    if (!onDelete || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onDelete();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Could not delete",
      );
      setSaving(false);
    }
  };

  const stepperFields = fields.filter((field) => STEPPER_FIELDS[field]);
  const inputFields = fields.filter((field) => !STEPPER_FIELDS[field]);
  const duration = splitDuration(draft);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-muted/40 ring-foreground/10 flex flex-col gap-3 rounded-xl p-3 ring-1"
    >
      {stepperFields.length > 0 && (
        <div className="flex gap-3">
          {stepperFields.map((field) => (
            <Stepper
              key={field}
              label={FIELD_LABELS[field]}
              step={STEPPER_FIELDS[field] ?? 1}
              value={draft[field] ?? ""}
              onChange={(value) => setField(field, value)}
            />
          ))}
        </div>
      )}

      {inputFields.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {inputFields.map((field) =>
            field === "duration_seconds" ? (
              <div key={field} className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">
                  {FIELD_LABELS[field]}
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    aria-label="Minutes"
                    placeholder="min"
                    className="h-11 min-w-0 text-center"
                    value={duration.minutes}
                    onChange={(event) =>
                      setDurationPart("minutes", event.target.value)
                    }
                  />
                  <span className="text-muted-foreground">:</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="59"
                    aria-label="Seconds"
                    placeholder="sec"
                    className="h-11 min-w-0 text-center"
                    value={duration.seconds}
                    onChange={(event) =>
                      setDurationPart("seconds", event.target.value)
                    }
                  />
                </div>
              </div>
            ) : (
              <div key={field} className="flex flex-col gap-1.5">
                <label
                  htmlFor={`set-${field}`}
                  className="text-muted-foreground text-xs font-medium"
                >
                  {FIELD_LABELS[field]}
                </label>
                <Input
                  id={`set-${field}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  className="h-11"
                  value={draft[field] ?? ""}
                  onChange={(event) => setField(field, event.target.value)}
                />
              </div>
            ),
          )}
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" className="h-11 w-full" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </Button>

      {(onDelete || onCancel) && (
        <div className="flex items-center justify-between gap-2">
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              className="h-10 flex-1"
              disabled={saving}
              onClick={handleDelete}
            >
              Delete set
            </Button>
          ) : (
            <span />
          )}
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              className="h-10 flex-1"
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
