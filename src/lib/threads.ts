import { useCallback, useEffect, useState } from "react";
import type { UIMessage } from "ai";

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
};

const KEY = "reachly:threads:v1";

function read(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Thread[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(threads: Thread[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(threads));
}

export function newThreadId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);

  useEffect(() => {
    setThreads(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setThreads(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: Thread[]) => {
    const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
    write(sorted);
    setThreads(sorted);
  }, []);

  const createThread = useCallback(
    (id?: string): Thread => {
      const thread: Thread = {
        id: id ?? newThreadId(),
        title: "New search",
        updatedAt: Date.now(),
        messages: [],
      };
      persist([thread, ...read().filter((t) => t.id !== thread.id)]);
      return thread;
    },
    [persist],
  );

  const deleteThread = useCallback(
    (id: string) => {
      persist(read().filter((t) => t.id !== id));
    },
    [persist],
  );

  const updateThread = useCallback(
    (id: string, patch: Partial<Thread>) => {
      const all = read();
      const idx = all.findIndex((t) => t.id === id);
      const base: Thread =
        idx >= 0
          ? all[idx]!
          : { id, title: "New search", updatedAt: Date.now(), messages: [] };
      const updated: Thread = {
        ...base,
        ...patch,
        id,
        updatedAt: Date.now(),
      };
      const next = idx >= 0 ? all.map((t) => (t.id === id ? updated : t)) : [updated, ...all];
      persist(next);
    },
    [persist],
  );

  const getThread = useCallback((id: string): Thread | undefined => {
    return read().find((t) => t.id === id);
  }, []);

  return { threads, createThread, deleteThread, updateThread, getThread };
}

export function loadThread(id: string): Thread | undefined {
  return read().find((t) => t.id === id);
}
