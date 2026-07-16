/**
 * Undo/redo stacks for the spreadsheet, as pure functions so they can be tested without
 * mounting the grid. ControlClient holds the three pieces of state and calls these.
 *
 * `past` = snapshots taken before each edit, oldest first.
 * `future` = what undo took away, next-to-redo first.
 */

export interface HistoryState<T> {
  present: T;
  past: T[];
  future: T[];
}

/** Records a user edit. Drops `future`: editing after an undo forks the timeline, like Excel. */
export function commit<T>(state: HistoryState<T>, next: T, limit: number): HistoryState<T> {
  return {
    present: next,
    past: [...state.past, state.present].slice(-limit),
    future: [],
  };
}

/** Steps back one edit. No-op when there is nothing to undo. */
export function undo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1]!;
  return {
    present: previous,
    past: state.past.slice(0, -1),
    future: [state.present, ...state.future],
  };
}

/** Steps forward one undone edit. No-op when there is nothing to redo. */
export function redo<T>(state: HistoryState<T>, limit: number): HistoryState<T> {
  if (state.future.length === 0) return state;
  const next = state.future[0]!;
  return {
    present: next,
    past: [...state.past, state.present].slice(-limit),
    future: state.future.slice(1),
  };
}

export const canUndo = <T>(s: HistoryState<T>): boolean => s.past.length > 0;
export const canRedo = <T>(s: HistoryState<T>): boolean => s.future.length > 0;
