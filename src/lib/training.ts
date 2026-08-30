// Shapes and formatting shared by the log views and the editing forms.

export const CATEGORIES = [
  "weighted_reps",
  "bodyweight_reps",
  "cardio",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type TrainingType = {
  id: number;
  training_name: string;
  category: Category;
};

export type TrainingSet = {
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

// One training type performed on one date. A gym visit is every session
// sharing a performed_on, ordered by session_order.
export type Session = {
  id: number;
  performed_on: string;
  session_order: number;
  notes: string | null;
  training_name: string;
  category: Category;
  sets: TrainingSet[];
};

// The columns a set can carry, minus avg_speed_kmh which the database derives.
export type SetField =
  | "weight_kg"
  | "reps"
  | "duration_seconds"
  | "distance_km"
  | "avg_heart_rate_bpm"
  | "avg_power_watts"
  | "avg_cadence";

export type SetInput = Partial<Record<SetField, number | null>>;

// Which fields a form offers depends on the category; which ones *display*
// still follows the data, so an old row with unusual columns still renders.
export const CATEGORY_FIELDS: Record<Category, SetField[]> = {
  weighted_reps: ["weight_kg", "reps"],
  bodyweight_reps: ["reps"],
  cardio: [
    "duration_seconds",
    "distance_km",
    "avg_heart_rate_bpm",
    "avg_power_watts",
    "avg_cadence",
  ],
};

export const FIELD_LABELS: Record<SetField, string> = {
  weight_kg: "Weight (kg)",
  reps: "Reps",
  duration_seconds: "Duration",
  distance_km: "Distance (km)",
  avg_heart_rate_bpm: "Avg HR (bpm)",
  avg_power_watts: "Avg power (W)",
  avg_cadence: "Cadence",
};

// dot colour per category, used in the calendar cells
export const CATEGORY_DOTS: Record<Category, string> = {
  weighted_reps: "bg-chart-5",
  bodyweight_reps: "bg-chart-3",
  cardio: "bg-chart-2",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  weighted_reps: "Weighted reps",
  bodyweight_reps: "Bodyweight reps",
  cardio: "Cardio",
};

// "2026-08-12" -> local midnight. new Date("2026-08-12") parses as UTC and
// renders as the day before west of Greenwich.
export const parseDay = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const localKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const todayKey = () => localKey(new Date());

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
export const formatSet = (set: TrainingSet) => {
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

// Sessions arrive newest day first, in performed order within a day. Local
// inserts have to be re-sorted the same way.
export const sortSessions = (sessions: Session[]) =>
  [...sessions].sort(
    (a, b) =>
      b.performed_on.localeCompare(a.performed_on) ||
      a.session_order - b.session_order,
  );
