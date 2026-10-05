/**
 * persistence.ts — guarded localStorage access + validated persistent state.
 *
 * localStorage is untrusted input: every read goes through try/catch (private
 * windows, cleared storage) and every restore goes through the caller's
 * validator. Stored data that no longer matches the current grammar is
 * dropped instead of reproduced (see structure page's PersistedTabsSchema).
 */
import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "protheon:";

export function storageRead<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function storageWrite(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode — persistence is best-effort */
  }
}

export function storageRemove(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/**
 * useState that hydrates from localStorage and persists on change.
 * `validate` receives the stored value and returns it (or null to drop it).
 *
 * Hydration-safe: the server always renders `initial` (there is no storage
 * during prerender), so the client's FIRST render must also use `initial` —
 * the stored value is adopted in an effect right after hydration. Reading
 * storage inside the useState initializer diverges the server/client trees
 * and triggers a hydration error whenever a stored value differs from
 * `initial`.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  validate: (stored: unknown) => T | null,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const validateRef = useRef(validate);
  validateRef.current = validate;
  const adopted = useRef(false);
  const skipNextWrite = useRef(false);

  useEffect(() => {
    const stored = storageRead<unknown>(key);
    if (stored !== undefined) {
      const valid = validateRef.current(stored);
      if (valid !== null && valid !== initial) {
        // Queue the stored value; skip persisting `initial` in the same
        // commit so a stored preference is never clobbered, even briefly.
        skipNextWrite.current = true;
        setValue(valid);
      }
    }
    adopted.current = true;
  }, [key]);

  useEffect(() => {
    if (skipNextWrite.current) {
      // This commit still carries the pre-adoption value — the next render
      // (with the adopted value) performs the write.
      skipNextWrite.current = false;
      return;
    }
    if (adopted.current) storageWrite(key, value);
  }, [key, value]);

  return [value, setValue];
}

/** Simple boolean/string persistent flag without a custom validator. */
export function usePersistentFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, set] = usePersistentState<boolean>(key, initial, (v) =>
    typeof v === "boolean" ? v : null,
  );
  const setValue = useCallback((v: boolean) => set(v), [set]);
  return [value, setValue];
}
