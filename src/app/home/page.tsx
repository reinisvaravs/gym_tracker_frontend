"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TrainingSet = {
  id: number;
  set_order: number;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_km: number | null;
  avg_speed_kmh: number | null;
  avg_heart_rate_bpm: number | null;
  avg_power_watts: number | null;
  avg_cadence: number | null;
};

type Session = {
  id: number;
  performed_on: string;
  notes: string | null;
  training_name: string;
  category: "weighted_reps" | "bodyweight_reps" | "cardio";
  sets: TrainingSet[];
};

type View = "list" | "calendar";

// dot colour per category, used in the calendar cells
const CATEGORY_DOTS: Record<Session["category"], string> = {
  weighted_reps: "bg-chart-5",
  bodyweight_reps: "bg-chart-3",
  cardio: "bg-chart-2",
};

// "2026-08-12" -> local midnight. new Date("2026-08-12") parses as UTC and
// renders as the day before west of Greenwich.
const parseDay = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

// 3725 -> "1:02:05", 330 -> "5:30"
const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0
    ? `${h}:${pad(m)}:${pad(seconds % 60)}`
    : `${m}:${pad(seconds % 60)}`;
};

// One set on one line, in the shorthand a lifter would actually write:
// "60 × 8" for weights, "× 12" bodyweight, "5.2 km · 24:30 · 12.7 km/h" cardio.
// Which parts appear follows the data, so no per-category branching.
const formatSet = (set: TrainingSet) => {
  const parts: string[] = [];

  if (set.weight_kg !== null) {
    parts.push(
      set.reps !== null
        ? `${set.weight_kg} × ${set.reps}`
        : `${set.weight_kg} kg`,
    );
  } else if (set.reps !== null) {
    parts.push(`× ${set.reps}`);
  }

  if (set.distance_km !== null) {
    parts.push(`${set.distance_km} km`);
  }
  if (set.duration_seconds !== null) {
    parts.push(formatDuration(set.duration_seconds));
  }
  if (set.avg_speed_kmh !== null) {
    parts.push(`${set.avg_speed_kmh} km/h`);
  }
  if (set.avg_heart_rate_bpm !== null) {
    parts.push(`${set.avg_heart_rate_bpm} bpm`);
  }
  if (set.avg_power_watts !== null) {
    parts.push(`${set.avg_power_watts} W`);
  }
  if (set.avg_cadence !== null) {
    parts.push(`${set.avg_cadence} rpm`);
  }

  return parts.join(" · ") || "—";
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// "2026-08-12" / "2026-08-12T00:00:00Z" -> "2026-08-12" without timezone drift
const dateKey = (performedOn: string) => {
  const iso = performedOn.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso;
  }
  const parsed = new Date(performedOn);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

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

const localKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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

function SessionSets({ sets }: { sets: TrainingSet[] }) {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // Calendar day whose sets are shown below the grid. Clicking pins a day,
  // hovering only previews it, so touch and keyboard work the same as a mouse.
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    // Get all sessions
    const getAllSessions = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/sessions/get-all`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include", // include cookies in the request
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.message || "Sessions fetch failed");
          return;
        }

        setSessions(await response.json());
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Error fetching sessions:", error);
        setError("An error occurred while loading sessions.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    getAllSessions();
    return () => controller.abort();
  }, []);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = dateKey(session.performed_on);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(session);
      } else {
        map.set(key, [session]);
      }
    }
    return map;
  }, [sessions]);

  // The API orders sessions newest-first, and a Map keeps insertion order,
  // so the days come out newest-first too.
  const groupedDays = useMemo(
    () => [...sessionsByDate.entries()],
    [sessionsByDate],
  );

  const days = useMemo(() => buildMonthGrid(month), [month]);
  const todayKey = localKey(new Date());

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
                        key === todayKey &&
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
      ) : sessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sessions yet</CardTitle>
            <CardDescription>
              Log your first workout and it will show up here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {groupedDays.map(([key, daySessions]) => (
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
                  </CardTitle>
                </CardHeader>

                <CardContent className="divide-y">
                  {daySessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            CATEGORY_DOTS[session.category],
                          )}
                        />
                        <span className="text-sm font-medium">
                          {session.training_name}
                        </span>
                      </div>

                      <SessionSets sets={session.sets} />

                      {session.notes && (
                        <p className="text-muted-foreground border-l-2 pl-2 text-xs">
                          {session.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
