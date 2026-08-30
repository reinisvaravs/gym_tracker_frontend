"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AddExercise } from "@/components/add-exercise";
import { ExerciseLog } from "@/components/exercise-log";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import {
  CATEGORY_DOTS,
  formatSet,
  localKey,
  parseDay,
  sortSessions,
  todayKey,
  type Category,
  type Session,
  type SetInput,
  type TrainingType,
} from "@/lib/training";
import { cn } from "@/lib/utils";

type View = "list" | "calendar";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CURRENT_YEAR = new Date().getFullYear();

// year is only shown when it is not the current one
const formatDay = (date: Date) =>
  date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === CURRENT_YEAR ? {} : { year: "numeric" }),
  });

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

// Read-only set list, for the calendar preview where nothing is editable
function SessionSets({ sets }: { sets: Session["sets"] }) {
  if (sets.length === 0) {
    return <p className="text-muted-foreground text-xs">No sets recorded.</p>;
  }

  return (
    <ol className="flex flex-col gap-0.5">
      {sets.map((set) => (
        <li key={set.id} className="text-xs tabular-nums">
          {formatSet(set)}
        </li>
      ))}
    </ol>
  );
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [types, setTypes] = useState<TrainingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // Calendar day whose sets are shown below the grid. Clicking pins a day,
  // hovering only previews it, so touch and keyboard work the same as a mouse.
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Today is what you log into, and it is recomputed per render so a session
  // spanning midnight doesn't keep writing into yesterday.
  const today = todayKey();

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
    (type: TrainingType) =>
      run(async () => {
        const created = await api.createSession(type.id, today);
        setSessions((current) => sortSessions([...current, created]));
      }),
    [run, today],
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

  // The API orders sessions newest day first, and a Map keeps insertion
  // order, so the days come out newest-first too. Today is pinned to the top
  // even before it has any exercises, since that is what you log into.
  const groupedDays = useMemo(() => {
    const entries = [...sessionsByDate.entries()];
    return sessionsByDate.has(today)
      ? entries
      : [[today, []] as const, ...entries];
  }, [sessionsByDate, today]);

  const days = useMemo(() => buildMonthGrid(month), [month]);

  // A pinned day wins over whatever is merely hovered
  const activeKey = pinnedKey ?? hoveredKey;
  const activeSessions = activeKey ? (sessionsByDate.get(activeKey) ?? []) : [];

  const shiftMonth = (delta: number) =>
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );

  const goToCurrentMonth = () => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Your sessions
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            Every workout you&apos;ve logged, newest first.
          </p>
        </div>

        <div className="bg-muted/50 ring-foreground/10 inline-flex gap-1 rounded-xl p-1 ring-1">
          {(["list", "calendar"] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={view === option ? "default" : "ghost"}
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className="capitalize"
            >
              {option}
            </Button>
          ))}
        </div>
      </header>

      {/* Mutation failures surface here rather than replacing the log: the
          sets you already saved should stay on screen. */}
      {actionError && (
        <div className="ring-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ring-1">
          <span>{actionError}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-muted/50 ring-foreground/10 h-24 animate-pulse rounded-xl ring-1"
            />
          ))}
        </div>
      ) : error ? (
        <Card size="sm" className="ring-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">
              Couldn&apos;t load sessions
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : view === "calendar" ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">{formatMonth(month)}</CardTitle>
            <CardAction className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                &#8249;
              </Button>
              <Button size="sm" variant="ghost" onClick={goToCurrentMonth}>
                Today
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
              >
                &#8250;
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-7 gap-px">
              {WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  className="text-muted-foreground pb-2 text-center text-xs font-medium"
                >
                  {weekday}
                </div>
              ))}
            </div>

            <div className="bg-foreground/10 ring-foreground/10 grid grid-cols-7 gap-px overflow-hidden rounded-lg ring-1">
              {days.map((day) => {
                const key = localKey(day);
                const daySessions = sessionsByDate.get(key) ?? [];
                const inMonth = day.getMonth() === month.getMonth();
                // Empty days stay plain divs so they don't become tab stops
                const interactive = daySessions.length > 0;

                const cellClass = cn(
                  "bg-card flex min-h-24 flex-col gap-1 p-1.5 text-left",
                  !inMonth && "bg-muted/40 text-muted-foreground",
                  interactive &&
                    "hover:bg-muted/60 cursor-pointer transition-colors",
                  pinnedKey === key && "ring-primary ring-2 ring-inset",
                );

                const content = (
                  <>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        key === today &&
                          "bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full font-medium",
                        inMonth ? "" : "opacity-60",
                      )}
                    >
                      {day.getDate()}
                    </span>

                    {daySessions.slice(0, 2).map((session) => (
                      <span
                        key={session.id}
                        className="bg-muted flex items-center gap-1 truncate rounded px-1 py-0.5 text-[0.65rem] leading-tight"
                      >
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            CATEGORY_DOTS[session.category],
                          )}
                        />
                        <span className="truncate">
                          {session.training_name}
                        </span>
                      </span>
                    ))}

                    {daySessions.length > 2 && (
                      <span className="text-muted-foreground px-1 text-[0.65rem]">
                        +{daySessions.length - 2} more
                      </span>
                    )}
                  </>
                );

                return interactive ? (
                  <button
                    key={key}
                    type="button"
                    className={cellClass}
                    aria-pressed={pinnedKey === key}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() =>
                      setHoveredKey((current) =>
                        current === key ? null : current,
                      )
                    }
                    onFocus={() => setHoveredKey(key)}
                    onBlur={() =>
                      setHoveredKey((current) =>
                        current === key ? null : current,
                      )
                    }
                    onClick={() =>
                      setPinnedKey((current) => (current === key ? null : key))
                    }
                  >
                    {content}
                  </button>
                ) : (
                  <div key={key} className={cellClass}>
                    {content}
                  </div>
                );
              })}
            </div>

            {/* Rendered below the grid rather than as a popover: the grid is
                overflow-hidden, which would clip anything absolutely
                positioned inside it. */}
            {activeKey && activeSessions.length > 0 && (
              <div className="mt-4 flex min-h-48 flex-col gap-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-sm font-medium">
                    {formatDay(parseDay(activeKey))}
                  </h3>
                  {pinnedKey && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPinnedKey(null)}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {activeSessions.map((session) => (
                  <div key={session.id} className="flex flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          CATEGORY_DOTS[session.category],
                        )}
                      />
                      <span className="text-sm font-medium">
                        {session.training_name}
                      </span>
                    </div>
                    <SessionSets sets={session.sets} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {groupedDays.map(([key, daySessions]) => {
            const isToday = key === today;

            return (
              <li key={key}>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>
                      {/* The date is the anchor when scrolling, so it sets its
                          own size rather than inheriting the card's small
                          title scale. */}
                      <time
                        dateTime={key}
                        className="font-heading text-lg font-semibold tracking-tight"
                      >
                        {formatDay(parseDay(key))}
                      </time>
                      {isToday && (
                        <span className="text-muted-foreground ml-2 text-xs font-normal">
                          Today
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
                          editable={isToday}
                          onAddSet={addSet}
                          onEditSet={editSet}
                          onDeleteSet={deleteSet}
                          onDeleteSession={deleteSession}
                        />
                      </div>
                    ))}

                    {/* Logging only happens on today, so the picker lives at
                        the bottom of today's card and nowhere else. */}
                    {isToday && (
                      <div className="pt-3 first:pt-0">
                        <AddExercise
                          types={types}
                          onPick={addExercise}
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
      )}
    </main>
  );
}
