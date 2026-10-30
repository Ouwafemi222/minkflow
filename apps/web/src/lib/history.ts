/** Bounded undo/redo history. Pure, so it can be unit-tested and used from a React reducer. */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const MAX_HISTORY = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function push<T>(h: History<T>, next: T, limit = MAX_HISTORY): History<T> {
  if (Object.is(next, h.present)) return h;
  const past = [...h.past, h.present];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past.at(-1);
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future;
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: rest };
}

/** Replace the present without recording history (e.g. server-confirmed narration timing). */
export function replace<T>(h: History<T>, present: T): History<T> {
  return { ...h, present };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item as T);
  return copy;
}
