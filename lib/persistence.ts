/**
 * persistence.ts — guarded localStorage access + validated persistent state.
 *
 * localStorage is untrusted input: every read goes through try/catch (private
 * windows, cleared storage) and every restore goes through the caller's
 * validator. Stored data that no longer matches the current grammar is
 * dropped instead of reproduced (see structure page's PersistedTabsSchema).
 */
import { useCallback, useEffect, useState } from "react";

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
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  validate: (stored: unknown) => T | null,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const stored = storageRead<unknown>(key);
    if (stored === undefined) return initial;
    return validate(stored) ?? initial;
  });

  useEffect(() => {
    storageWrite(key, value);
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
