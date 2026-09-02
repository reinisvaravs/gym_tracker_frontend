"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AddExercise } from "@/components/add-exercise";
import { ExerciseLog } from "@/components/exercise-log";
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  ListIcon,
  PencilIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import {
  CATEGORY_DOTS,
  localKey,
  parseDay,
  sortSessions,
  todayKey,
  type Category,
  type Session,
  type SetInput,
  type TrainingSet,
  type TrainingType,
} from "@/lib/training";
import { cn } from "@/lib/utils";

type View = "log" | "calendar";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CURRENT_YEAR = new Date().getFullYear();

// year is only shown when it is not the current one
const formatDay = (date: Date) =>
  date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === CURRENT_YEAR ? {} : { year: "numeric" }),
  });

const formatWeekday = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: "long" });

const formatMonth = (date: Date) =>
  date.toLocaleDateString(undefined, {
    month: "long",
    ...(date.getFullYear() === CURRENT_YEAR ? {} : { year: "numeric" }),
  });

// 6-week grid (42 days) starting on the Monday on or before the 1st
const buildMonthGrid = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Sunday (0) -> 6
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
};

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [types, setTypes] = useState<TrainingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [view, setView] = useState<View>("log");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Today is what you log into, and it is recomputed per render so a session
  // spanning midnight doesn't keep writing into yesterday.
  const today = todayKey();

  // Calendar day whose workout shows under the grid. Starts on today so the
  // calendar is never an empty screen.
  const [selectedKey, setSelectedKey] = useState(today);

  // A past day unlocked for editing via its pencil icon — for the rare case
  // of writing up yesterday's workout the morning after. One at a time keeps
  // the rest of the history compact and safe from stray taps.
  const [editingDay, setEditingDay] = useState<string | null>(null);

  // A day the date picker opened that has nothing logged on it yet. The log
  // only lists days that already have sessions, so a forgotten day needs one
  // to be conjured; it drops back out if it is closed still empty.
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  const openDay = (day: string) => {
    setPickedDay(day);
    setEditingDay(day);
  };

  const closeDay = (day: string) => {
    setEditingDay(null);
    setPickedDay((current) => (current === day ? null : current));
  };

  // The date field is transparent and sits under the button purely so the
  // native picker has something to anchor to. Clicking it directly only
  // focuses its (invisible) segments, so the button drives it instead.
  const dateInput = useRef<HTMLInputElement>(null);

  const pickDay = () => {
    const input = dateInput.current;
    if (!input) {
      return;
    }
    try {
      input.showPicker();
    } catch {
      // Older browsers, or a picker that refuses: focusing at least lets the
      // field be typed into.
      input.focus();
    }
  };

  // Names of training types the log view is narrowed to; empty = show all.
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  const toggleTypeFilter = (name: string) =>
    setTypeFilter((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });

  // Escape closes the filter dropdown, matching the add-exercise sheet
  useEffect(() => {
    if (!filterOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filterOpen]);

  // The opened day sorts into the list by date, so it usually lands below
  // the fold rather than where the tap happened.
  useEffect(() => {
    if (!pickedDay) {
      return;
    }
    document
      .getElementById(`day-${pickedDay}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pickedDay]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const [loadedSessions, loadedTypes] = await Promise.all([
          api.getSessions(controller.signal),
          api.getTypes(controller.signal),
        ]);
        setSessions(loadedSessions);
        setTypes(loadedTypes);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Error loading:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "An error occurred while loading.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, []);

  // Mutation failures show as a snackbar and fade on their own
  useEffect(() => {
    if (!actionError) {
      return;
    }
    const timer = setTimeout(() => setActionError(null), 5000);
    return () => clearTimeout(timer);
  }, [actionError]);

  // Every mutation patches local state from the server's response instead of
  // refetching: the whole history is already in memory, so a round-trip would
  // only re-download what we just changed.
  const run = useCallback(async (action: () => Promise<void>) => {
    try {
      setActionError(null);
      await action();
    } catch (mutationError) {
      setActionError(
        mutationError instanceof Error
          ? mutationError.message
          : "Something went wrong",
      );
      throw mutationError;
    }
  }, []);

  const addExercise = useCallback(
    (type: TrainingType, day: string) =>
      run(async () => {
        const created = await api.createSession(type.id, day);
        setSessions((current) => sortSessions([...current, created]));
      }),
    [run],
  );

  const createType = useCallback(async (name: string, category: Category) => {
    const created = await api.createType(name, category);
    setTypes((current) =>
      [...current, created].sort((a, b) =>
        a.training_name.localeCompare(b.training_name),
      ),
    );
    return created;
  }, []);

  const addSet = useCallback(
    (sessionId: number, set: SetInput) =>
      run(async () => {
        const created = await api.addSet(sessionId, set);
        setSessions((current) =>
          current.map((session) =>
            session.id === sessionId
              ? { ...session, sets: [...session.sets, created] }
              : session,
          ),
        );
      }),
    [run],
  );

  const editSet = useCallback(
    (setId: number, set: SetInput) =>
      run(async () => {
        const updated = await api.editSet(setId, set);
        setSessions((current) =>
          current.map((session) => ({
            ...session,
            sets: session.sets.map((existing) =>
              existing.id === setId ? updated : existing,
            ),
          })),
        );
      }),
    [run],
  );

  const deleteSet = useCallback(
    (setId: number) =>
      run(async () => {
        await api.deleteSet(setId);
        setSessions((current) =>
          current.map((session) => ({
            ...session,
            sets: session.sets.filter((existing) => existing.id !== setId),
          })),
        );
      }),
    [run],
  );

  // Optimistic: the arrows have to feel instant, and the whole day is sent
  // so the server renumbers in one transaction rather than the client
  // guessing at two half-applied swaps. A failure puts the old order back.
  const moveSession = useCallback(
    (day: string, sessionId: number, delta: number) => {
      const snapshot = sessions;
      const ids = snapshot
        .filter((session) => session.performed_on.slice(0, 10) === day)
        .sort((a, b) => a.session_order - b.session_order)
        .map((session) => session.id);

      const from = ids.indexOf(sessionId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) {
        return;
      }
      [ids[from], ids[to]] = [ids[to], ids[from]];

      const order = new Map(ids.map((id, index) => [id, index + 1]));
      setSessions((current) =>
        sortSessions(
          current.map((session) => {
            const position = order.get(session.id);
            return position === undefined
              ? session
              : { ...session, session_order: position };
          }),
        ),
      );

      run(async () => {
        try {
          await api.reorderSessions(day, ids);
        } catch (reorderError) {
          setSessions(snapshot);
          throw reorderError;
        }
      }).catch(() => {
        // run() has already put the message in the snackbar
      });
    },
    [run, sessions],
  );

  const deleteSession = useCallback(
    (sessionId: number) =>
      run(async () => {
        await api.deleteSession(sessionId);
        setSessions((current) =>
          current.filter((session) => session.id !== sessionId),
        );
      }),
    [run],
  );

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = session.performed_on.slice(0, 10);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(session);
      } else {
        map.set(key, [session]);
      }
    }
    return map;
  }, [sessions]);

  // Arrows are hidden on a lone exercise and greyed at the ends of the day.
  // The position comes from the day's full list rather than the filtered one,
  // so reordering under an active filter still moves against the real order.
  const moveProps = (
    day: string,
    sessionId: number,
  ): { onMoveUp?: () => void; onMoveDown?: () => void } => {
    const ordered = sessionsByDate.get(day) ?? [];
    if (ordered.length < 2) {
      return {};
    }
    const index = ordered.findIndex((session) => session.id === sessionId);
    return {
      onMoveUp: index > 0 ? () => moveSession(day, sessionId, -1) : undefined,
      onMoveDown:
        index < ordered.length - 1
          ? () => moveSession(day, sessionId, 1)
          : undefined,
    };
  };

  // Newest day first. Today is always present even before it has any
  // exercises, since that is what you log into, and so is a day opened from
  // the date picker. Both are appended and the whole list re-sorted, because
  // a Map keeps insertion order rather than date order.
  const groupedDays = useMemo(() => {
    const days = new Map(sessionsByDate);
    if (!days.has(today)) {
      days.set(today, []);
    }
    if (pickedDay && !days.has(pickedDay)) {
      days.set(pickedDay, []);
    }
    return [...days.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [sessionsByDate, today, pickedDay]);

  // Only types that actually appear in the log are worth offering, most
  // frequently trained first so the usual suspects sit at the top.
  const filterableTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) {
      counts.set(
        session.training_name,
        (counts.get(session.training_name) ?? 0) + 1,
      );
    }
    return types
      .filter((type) => counts.has(type.training_name))
      .sort(
        (a, b) =>
          counts.get(b.training_name)! - counts.get(a.training_name)! ||
          a.training_name.localeCompare(b.training_name),
      );
  }, [sessions, types]);

  const visibleDays = useMemo(() => {
    if (typeFilter.size === 0) {
      return groupedDays;
    }
    return groupedDays
      .map(
        ([key, daySessions]) =>
          [
            key,
            daySessions.filter((session) =>
              typeFilter.has(session.training_name),
            ),
          ] as const,
      )
      .filter(
        ([key, daySessions]) => daySessions.length > 0 || key === pickedDay,
      );
  }, [groupedDays, typeFilter, pickedDay]);

  // For each exercise: the last set of the most recent past workout of it,
  // so the first set of the day starts prefilled from where you left off.
  const lastKnownSetByName = useMemo(() => {
    const map = new Map<string, TrainingSet>();
    for (const session of sessions) {
      if (session.performed_on.slice(0, 10) === today) {
        continue;
      }
      if (!map.has(session.training_name) && session.sets.length > 0) {
        map.set(session.training_name, session.sets[session.sets.length - 1]);
      }
    }
    return map;
  }, [sessions, today]);

  const days = useMemo(() => buildMonthGrid(month), [month]);

  const selectedSessions = sessionsByDate.get(selectedKey) ?? [];
  const isCurrentMonth =
    month.getFullYear() === new Date().getFullYear() &&
    month.getMonth() === new Date().getMonth();

  const shiftMonth = (delta: number) =>
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );

  const goToToday = () => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(today);
  };

  return (
    <>
      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
          <h1 className="font-heading text-lg font-bold tracking-tight">
            Training log
          </h1>
          <time className="text-muted-foreground text-sm">
            {formatDay(new Date())}
          </time>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-muted/50 ring-foreground/10 h-36 animate-pulse rounded-xl ring-1"
              />
            ))}
          </div>
        ) : error ? (
          <Card size="sm" className="ring-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">
                Couldn&apos;t load your log
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : view === "calendar" ? (
          <>
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="font-heading text-base font-semibold">
                {formatMonth(month)}
              </span>
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>

            <div>
              <div className="grid grid-cols-7">
                {WEEKDAYS.map((weekday) => (
                  <div
                    key={weekday}
                    className="text-muted-foreground pb-1 text-center text-[0.65rem] font-medium"
                  >
                    {weekday}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const key = localKey(day);
                  const daySessions = sessionsByDate.get(key) ?? [];
                  const inMonth = day.getMonth() === month.getMonth();
                  const selected = selectedKey === key;

                  // Only the first name is spelled out — an ellipsis stands
                  // in for the rest, and the day card below lists them all.
                  const [first, ...rest] = daySessions;

                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        if (key !== selectedKey) {
                          setEditingDay(null);
                        }
                        setSelectedKey(key);
                      }}
                      className={cn(
                        "flex aspect-square flex-col items-center gap-0.5 overflow-hidden rounded-lg p-0.5 pt-1 transition-colors",
                        !inMonth && "text-muted-foreground/50",
                        selected
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "active:bg-muted",
                        !selected &&
                          key === today &&
                          "text-primary ring-primary/40 font-bold ring-1",
                      )}
                    >
                      <span className="text-[0.7rem] leading-none tabular-nums">
                        {day.getDate()}
                      </span>

                      {/* The names are what the month is scanned for, so they
                          replace the category dots rather than sit beside
                          them — the palette is greyscale and a name says more
                          than its shade did. */}
                      <span
                        className={cn(
                          "flex w-full flex-col gap-px text-[0.55rem] leading-tight font-normal",
                          selected
                            ? "text-primary-foreground/90"
                            : "text-muted-foreground",
                        )}
                      >
                        {first && (
                          <span className="truncate">
                            {first.training_name}
                          </span>
                        )}
                        {rest.length > 0 && <span aria-hidden>…</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!isCurrentMonth && (
              <Button
                variant="ghost"
                className="h-9 self-center"
                onClick={goToToday}
              >
                Jump to today
              </Button>
            )}

            <Card
              size="sm"
              className={cn(editingDay === selectedKey && "ring-primary/30")}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-baseline gap-2">
                    <span className="font-heading text-lg font-semibold tracking-tight">
                      {formatDay(parseDay(selectedKey))}
                    </span>
                    <span className="text-muted-foreground text-xs font-normal">
                      {formatWeekday(parseDay(selectedKey))}
                    </span>
                  </span>
                  {editingDay === selectedKey ? (
                    <Button
                      variant="ghost"
                      className="text-primary h-8"
                      onClick={() => setEditingDay(null)}
                    >
                      Done
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit this day"
                      className="text-muted-foreground"
                      onClick={() => setEditingDay(selectedKey)}
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {selectedSessions.length === 0 &&
                  editingDay !== selectedKey && (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                      No workout on this day.
                    </p>
                  )}
                {selectedSessions.map((session) => (
                  <div key={session.id} className="py-3 first:pt-0 last:pb-0">
                    <ExerciseLog
                      session={session}
                      editable={editingDay === selectedKey}
                      {...moveProps(selectedKey, session.id)}
                      previousSet={
                        lastKnownSetByName.get(session.training_name) ?? null
                      }
                      onAddSet={addSet}
                      onEditSet={editSet}
                      onDeleteSet={deleteSet}
                      onDeleteSession={deleteSession}
                    />
                  </div>
                ))}
                {editingDay === selectedKey && (
                  <div className="pt-3 first:pt-0">
                    <AddExercise
                      types={types}
                      onPick={(type) => addExercise(type, selectedKey)}
                      onCreateType={createType}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="relative">
                <Button variant="outline" className="h-9" onClick={pickDay}>
                  <CalendarIcon className="size-4" />
                  Earlier day
                </Button>
                <input
                  ref={dateInput}
                  type="date"
                  max={today}
                  tabIndex={-1}
                  aria-label="Log an earlier day"
                  className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                  onChange={(event) => {
                    const day = event.target.value;
                    // Cleared so re-picking the same day fires again
                    event.target.value = "";
                    if (day && day <= today) {
                      openDay(day);
                    }
                  }}
                />
              </div>

              {filterableTypes.length > 1 && (
                <div className="relative">
                  <Button
                    variant="outline"
                    className="h-9"
                    aria-haspopup="listbox"
                    aria-expanded={filterOpen}
                    onClick={() => setFilterOpen((current) => !current)}
                  >
                    <FilterIcon className="size-4" />
                    Filter
                    {typeFilter.size > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums">
                        {typeFilter.size}
                      </span>
                    )}
                  </Button>

                  {filterOpen && (
                    <>
                      {/* invisible backdrop so any outside tap closes it */}
                      <button
                        type="button"
                        aria-label="Close filter"
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setFilterOpen(false)}
                      />
                      <div
                        role="listbox"
                        aria-label="Filter by exercise"
                        aria-multiselectable="true"
                        className="bg-background ring-foreground/10 absolute top-full right-0 z-50 mt-1 flex max-h-72 w-60 flex-col gap-0.5 overflow-y-auto rounded-xl p-1.5 shadow-lg ring-1"
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={typeFilter.size === 0}
                          onClick={() => {
                            setTypeFilter(new Set());
                            setFilterOpen(false);
                          }}
                          className="hover:bg-muted active:bg-muted flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors"
                        >
                          All exercises
                          {typeFilter.size === 0 && (
                            <CheckIcon className="text-primary ml-auto size-4 shrink-0" />
                          )}
                        </button>

                        {filterableTypes.map((type) => {
                          const active = typeFilter.has(type.training_name);
                          return (
                            <button
                              key={type.id}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() =>
                                toggleTypeFilter(type.training_name)
                              }
                              className="hover:bg-muted active:bg-muted flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors"
                            >
                              <span
                                className={cn(
                                  "size-2 shrink-0 rounded-full",
                                  CATEGORY_DOTS[type.category],
                                )}
                              />
                              <span className="truncate">
                                {type.training_name}
                              </span>
                              {active && (
                                <CheckIcon className="text-primary ml-auto size-4 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {visibleDays.length === 0 && (
              <p className="text-muted-foreground py-10 text-center text-sm">
                No workouts match this filter.
              </p>
            )}

            <ul className="flex flex-col gap-3">
              {visibleDays.map(([key, daySessions]) => {
                const isToday = key === today;
                // Today is always open for logging; a past day opens via its
                // pencil or the date picker, so history stays compact and
                // tap-safe until you ask for it.
                const isEditing = isToday || editingDay === key;

                return (
                  <li key={key} id={`day-${key}`}>
                    <Card
                      size="sm"
                      className={cn(isEditing && "ring-primary/30")}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          {/* The date is the anchor when scrolling, so it sets
                            its own size rather than inheriting the card's
                            small title scale. */}
                          <time
                            dateTime={key}
                            className="font-heading text-lg font-semibold tracking-tight"
                          >
                            {formatDay(parseDay(key))}
                          </time>
                          {isToday ? (
                            <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase">
                              Today
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <span className="text-muted-foreground text-xs font-normal">
                                {formatWeekday(parseDay(key))}
                              </span>
                              {editingDay === key ? (
                                <Button
                                  variant="ghost"
                                  className="text-primary h-8"
                                  onClick={() => closeDay(key)}
                                >
                                  Done
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Edit this day"
                                  className="text-muted-foreground"
                                  onClick={() => setEditingDay(key)}
                                >
                                  <PencilIcon className="size-3.5" />
                                </Button>
                              )}
                            </span>
                          )}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="divide-y">
                        {daySessions.map((session) => (
                          <div
                            key={session.id}
                            className="py-3 first:pt-0 last:pb-0"
                          >
                            <ExerciseLog
                              session={session}
                              editable={isEditing}
                              {...moveProps(key, session.id)}
                              previousSet={
                                lastKnownSetByName.get(session.training_name) ??
                                null
                              }
                              onAddSet={addSet}
                              onEditSet={editSet}
                              onDeleteSet={deleteSet}
                              onDeleteSession={deleteSession}
                            />
                          </div>
                        ))}

                        {/* The picker lives at the bottom of whichever day is
                          open for logging — today, or a pencil-unlocked one. */}
                        {isEditing && (
                          <div className="pt-3 first:pt-0">
                            {daySessions.length === 0 && (
                              <p className="text-muted-foreground pb-3 text-center text-sm">
                                Nothing logged yet — pick your first exercise.
                              </p>
                            )}
                            <AddExercise
                              types={types}
                              onPick={(type) => addExercise(type, key)}
                              onCreateType={createType}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>

      {/* Mutation failures surface as a snackbar above the tab bar rather
          than replacing the log: the sets already saved stay on screen. */}
      {actionError && (
        <div
          role="alert"
          className="bg-card text-destructive ring-destructive/40 fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-105 -translate-x-1/2 rounded-xl px-4 py-3 text-sm shadow-lg ring-1"
        >
          {actionError}
        </div>
      )}

      <nav className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur">
        <div className="mx-auto grid w-full max-w-md grid-cols-2 pb-[env(safe-area-inset-bottom)]">
          {(
            [
              { id: "log", label: "Log", Icon: ListIcon },
              { id: "calendar", label: "Calendar", Icon: CalendarIcon },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={view === id ? "page" : undefined}
              onClick={() => {
                setView(id);
                setEditingDay(null);
                setPickedDay(null);
                setFilterOpen(false);
              }}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium transition-colors",
                view === id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
