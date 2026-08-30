import type {
  Category,
  Session,
  SetInput,
  TrainingSet,
  TrainingType,
} from "./training";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// Every call is cookie-authenticated and throws the server's own message on
// failure, so callers only handle one error shape.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${response.status})`);
  }

  return response.json();
}

export const api = {
  getSessions: (signal?: AbortSignal) =>
    request<Session[]>("/sessions/get-all", { signal }),

  getTypes: (signal?: AbortSignal) =>
    request<TrainingType[]>("/types/get-all", { signal }),

  createType: (trainingName: string, category: Category) =>
    request<TrainingType>("/types/create", {
      method: "POST",
      body: JSON.stringify({ trainingName, category }),
    }),

  // Sets are added afterwards one at a time, so this starts empty
  createSession: (trainingTypeId: number, performedOn: string) =>
    request<Session>("/sessions/create", {
      method: "POST",
      body: JSON.stringify({ trainingTypeId, performedOn, sets: [] }),
    }),

  deleteSession: (id: number) =>
    request<{ id: number }>(`/sessions/delete/${id}`, { method: "DELETE" }),

  editSessionNotes: (id: number, notes: string | null) =>
    request<{ id: number }>(`/sessions/edit/${id}`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    }),

  addSet: (sessionId: number, set: SetInput) =>
    request<TrainingSet>("/sessions/sets/create", {
      method: "POST",
      body: JSON.stringify({ sessionId, ...set }),
    }),

  // A full replace: fields left out are cleared
  editSet: (id: number, set: SetInput) =>
    request<TrainingSet>(`/sessions/sets/edit/${id}`, {
      method: "PUT",
      body: JSON.stringify(set),
    }),

  deleteSet: (id: number) =>
    request<{ id: number }>(`/sessions/sets/delete/${id}`, {
      method: "DELETE",
    }),
};
