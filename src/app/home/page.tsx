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

type Session = {
  id: number;
  performed_on: string;
  notes: string | null;
  training_name: string;
  category: "weighted_reps" | "bodyweight_reps" | "cardio";
  set_count: number;
};

type View = "list" | "calendar";

// dot colour per category, used in the calendar cells
const CATEGORY_DOTS: Record<Session["category"], string> = {
  weighted_reps: "bg-chart-5",
  bodyweight_reps: "bg-chart-3",
  cardio: "bg-chart-2",
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

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

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

  const days = useMemo(() => buildMonthGrid(month), [month]);
  const todayKey = localKey(new Date());

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

                return (
                  <div
                    key={key}
                    className={cn(
                      "bg-card flex min-h-24 flex-col gap-1 p-1.5",
                      !inMonth && "bg-muted/40 text-muted-foreground",
                    )}
                  >
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
                        title={`${session.training_name} · ${session.set_count} set${session.set_count === 1 ? "" : "s"}`}
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
                  </div>
                );
              })}
            </div>
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
          {sessions.map((session) => (
            <li key={session.id}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{session.training_name}</CardTitle>
                  <CardDescription>
                    {session.set_count} set{session.set_count === 1 ? "" : "s"}
                  </CardDescription>
                  <CardAction>
                    <time
                      dateTime={session.performed_on}
                      className="text-muted-foreground text-xs tabular-nums"
                    >
                      {formatDay(new Date(session.performed_on))}
                    </time>
                  </CardAction>
                </CardHeader>
                {session.notes && (
                  <CardContent>
                    <p className="text-muted-foreground border-l-2 pl-3 text-sm">
                      {session.notes}
                    </p>
                  </CardContent>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
