import { useCallback } from 'react';

export interface PendingToggle {
  type: 'toggle';
  id: string;
  itemId: string;
  is_checked: boolean;
  timestamp: number;
}

export interface PendingEdit {
  type: 'edit';
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  unit: string;
  timestamp: number;
}

export interface PendingDelete {
  type: 'delete';
  id: string;
  itemId: string;
  timestamp: number;
}

export interface PendingAdd {
  type: 'add';
  id: string;
  tempId: string;
  name: string;
  quantity: number;
  unit: string;
  timestamp: number;
}

export type PendingChange = PendingToggle | PendingEdit | PendingDelete | PendingAdd;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const STORAGE_KEY_PREFIX = 'pending_changes_';

function getStorageKey(listId: string): string {
  return `${STORAGE_KEY_PREFIX}${listId}`;
}

function readPendingChanges(listId: string): PendingChange[] {
  try {
    const key = getStorageKey(listId);
    const data = localStorage.getItem(key);
    if (!data) {
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as PendingChange[];
  } catch {
    return [];
  }
}

function writePendingChanges(listId: string, changes: PendingChange[]): void {
  try {
    const key = getStorageKey(listId);
    if (changes.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(changes));
    }
  } catch {
    // localStorage is full or unavailable, silently fail
  }
}

export function useOfflineQueue(listId: string) {
  const enqueue = useCallback(
    (change: DistributiveOmit<PendingChange, 'id' | 'timestamp'>): void => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const timestamp = Date.now();
      const newChange = { ...change, id, timestamp } as PendingChange;

      const existing = readPendingChanges(listId);
      writePendingChanges(listId, [...existing, newChange]);
    },
    [listId]
  );

  const getPending = useCallback((): PendingChange[] => {
    const changes = readPendingChanges(listId);
    return [...changes].sort((a, b) => a.timestamp - b.timestamp);
  }, [listId]);

  const dequeue = useCallback((changeId: string): void => {
    const changes = readPendingChanges(listId);
    const filtered = changes.filter((c) => c.id !== changeId);
    writePendingChanges(listId, filtered);
  }, [listId]);

  const clear = useCallback((): void => {
    writePendingChanges(listId, []);
  }, [listId]);

  return {
    enqueue,
    getPending,
    dequeue,
    clear,
  };
}