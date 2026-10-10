import { useCallback, useRef, useState } from "react";

type H<T> = { past: T[]; present: T; future: T[] };

/**
 * State with undo/redo. Changes sharing a `tag` within 600 ms (a slider drag, typing) collapse into one step.
 */
export function useHistory<T>(initial: T) {
  const [h, setH] = useState<H<T>>({ past: [], present: initial, future: [] });
  const last = useRef({ tag: "", at: 0 });

  const set = useCallback((next: T | ((prev: T) => T), tag = "") => {
    const now = Date.now();
    const merge = tag !== "" && tag === last.current.tag && now - last.current.at < 600;
    last.current = { tag, at: now };
    setH((h) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(h.present) : next;
      if (value === h.present) return h;
      return { past: merge ? h.past : [...h.past.slice(-99), h.present], present: value, future: [] };
    });
  }, []);
  const reset = useCallback((value: T) => setH({ past: [], present: value, future: [] }), []);
  const undo = useCallback(
    () => setH((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h)),
    [],
  );
  const redo = useCallback(
    () => setH((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h)),
    [],
  );
  return { state: h.present, set, reset, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
