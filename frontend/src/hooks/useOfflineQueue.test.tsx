import { render, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useOfflineQueue, type DistributiveOmit, type PendingChange, type PendingAdd } from './useOfflineQueue';

// Test component that uses the hook and exposes values via callback
const TestComponent = ({
  listId,
  onQueue,
}: {
  listId: string;
  onQueue: (queue: { enqueue: (change: DistributiveOmit<PendingChange, 'id' | 'timestamp'>) => void; getPending: () => PendingChange[]; dequeue: (id: string) => void; clear: () => void }) => void;
}) => {
  const queue = useOfflineQueue(listId);
  onQueue(queue);
  return null;
};

describe('useOfflineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Basic operations', () => {
    it('enqueue adds a change and getPending returns it', () => {
      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();
      capturedQueue!.enqueue({ type: 'toggle', itemId: 'item-1', is_checked: true });

      const pending = capturedQueue!.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].type).toBe('toggle');
      expect(pending[0].itemId).toBe('item-1');
      expect(pending[0].is_checked).toBe(true);
      expect(pending[0].id).toBeDefined();
      expect(pending[0].timestamp).toBeDefined();
    });

    it('getPending returns changes sorted by timestamp', () => {
      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();

      // Add changes with different types
      capturedQueue!.enqueue({ type: 'toggle', itemId: 'item-1', is_checked: true });
      capturedQueue!.enqueue({ type: 'delete', itemId: 'item-2' });
      capturedQueue!.enqueue({ type: 'edit', itemId: 'item-3', name: 'New Name', quantity: 2, unit: 'pcs' });

      const pending = capturedQueue!.getPending();
      expect(pending).toHaveLength(3);

      // Verify they are sorted by timestamp (oldest first)
      for (let i = 0; i < pending.length - 1; i++) {
        expect(pending[i].timestamp).toBeLessThanOrEqual(pending[i + 1].timestamp);
      }
    });

    it('dequeue removes a specific change', () => {
      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();

      // Add two changes
      capturedQueue!.enqueue({ type: 'toggle', itemId: 'item-1', is_checked: true });
      capturedQueue!.enqueue({ type: 'toggle', itemId: 'item-2', is_checked: false });

      const pending = capturedQueue!.getPending();
      expect(pending).toHaveLength(2);
      const firstChangeId = pending[0].id;

      // Dequeue only the first one
      capturedQueue!.dequeue(firstChangeId);

      const remaining = capturedQueue!.getPending();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(pending[1].id);
    });

    it('clear removes all changes', () => {
      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();

      // Add two changes
      capturedQueue!.enqueue({ type: 'toggle', itemId: 'item-1', is_checked: true });
      capturedQueue!.enqueue({ type: 'delete', itemId: 'item-2' });

      expect(capturedQueue!.getPending()).toHaveLength(2);

      // Clear all
      capturedQueue!.clear();

      expect(capturedQueue!.getPending()).toHaveLength(0);
    });

    it('enqueue generates unique IDs', () => {
      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();

      capturedQueue!.enqueue({ type: 'toggle', itemId: 'item-1', is_checked: true });
      capturedQueue!.enqueue({ type: 'toggle', itemId: 'item-2', is_checked: false });

      const pending = capturedQueue!.getPending();
      expect(pending).toHaveLength(2);
      expect(pending[0].id).not.toBe(pending[1].id);
    });
  });

  describe('Persistence', () => {
    it('data persists in localStorage', () => {
      // First hook instance: enqueue a change
      let queue1: ReturnType<typeof useOfflineQueue> | undefined;

      const { unmount } = render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { queue1 = q; }}
        />
      );

      expect(queue1).toBeDefined();
      queue1!.enqueue({ type: 'toggle', itemId: 'item-1', is_checked: true });

      // Verify it's in localStorage
      const storageData = localStorage.getItem('pending_changes_list-1');
      expect(storageData).toBeDefined();
      const parsed = JSON.parse(storageData!);
      expect(parsed).toHaveLength(1);

      // Unmount the first instance
      unmount();

      // Create a new hook instance for the same listId
      let queue2: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { queue2 = q; }}
        />
      );

      // Verify the persisted data is returned
      expect(queue2).toBeDefined();
      const pending = queue2!.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].itemId).toBe('item-1');
      expect(pending[0].type).toBe('toggle');
    });

    it('different list IDs are isolated', () => {
      let queue1: ReturnType<typeof useOfflineQueue> | undefined;
      let queue2: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { queue1 = q; }}
        />
      );

      // Use act to properly handle state updates and unmount
      act(() => {
        queue1!.enqueue({ type: 'toggle', itemId: 'item-1', is_checked: true });
      });

      // Create another hook instance with different listId
      render(
        <TestComponent
          listId="list-2"
          onQueue={(q) => { queue2 = q; }}
        />
      );

      act(() => {
        queue2!.enqueue({ type: 'delete', itemId: 'item-2' });
      });

      // Verify they are isolated
      const pending1 = queue1!.getPending();
      const pending2 = queue2!.getPending();

      expect(pending1).toHaveLength(1);
      expect(pending1[0].type).toBe('toggle');
      expect(pending1[0].itemId).toBe('item-1');

      expect(pending2).toHaveLength(1);
      expect(pending2[0].type).toBe('delete');
      expect(pending2[0].itemId).toBe('item-2');

      // Verify localStorage has separate keys
      expect(localStorage.getItem('pending_changes_list-1')).toBeDefined();
      expect(localStorage.getItem('pending_changes_list-2')).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('corrupted localStorage data returns empty array', () => {
      // Set corrupted JSON in localStorage
      localStorage.setItem('pending_changes_list-1', '{ invalid json }');

      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();
      const pending = capturedQueue!.getPending();
      expect(pending).toEqual([]);
    });

    it('invalid array data returns empty array', () => {
      // Set non-array JSON in localStorage
      localStorage.setItem('pending_changes_list-1', JSON.stringify({ not: 'an array' }));

      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();
      const pending = capturedQueue!.getPending();
      expect(pending).toEqual([]);
    });

    it('handles localStorage being null', () => {
      // This is implicitly tested by the empty initial state
      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="new-list-xyz"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();
      const pending = capturedQueue!.getPending();
      expect(pending).toEqual([]);
    });
  });

  describe('Edge cases', () => {
    it('empty queue returns empty array', () => {
      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="brand-new-list"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();
      const pending = capturedQueue!.getPending();
      expect(pending).toEqual([]);
      expect(pending).toHaveLength(0);
    });

    it('dequeue non-existent ID is safe', () => {
      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();

      // Add one change
      capturedQueue!.enqueue({ type: 'toggle', itemId: 'item-1', is_checked: true });

      expect(capturedQueue!.getPending()).toHaveLength(1);

      // Try to dequeue a non-existent ID - should not throw and should not remove other items
      expect(() => {
        capturedQueue!.dequeue('non-existent-id');
      }).not.toThrow();

      // Verify the original change is still there
      const pending = capturedQueue!.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].itemId).toBe('item-1');
    });

    it('clear on empty queue does not throw', () => {
      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();

      // Clear empty queue - should not throw
      expect(() => {
        capturedQueue!.clear();
      }).not.toThrow();

      expect(capturedQueue!.getPending()).toEqual([]);
    });

    it('enqueue generates id and timestamp correctly', () => {
      let capturedQueue: ReturnType<typeof useOfflineQueue> | undefined;

      render(
        <TestComponent
          listId="list-1"
          onQueue={(q) => { capturedQueue = q; }}
        />
      );

      expect(capturedQueue).toBeDefined();

      const beforeEnqueue = Date.now();
      capturedQueue!.enqueue({ type: 'add', tempId: 'temp-123', name: 'Test Item', quantity: 2, unit: 'pcs' });
      const afterEnqueue = Date.now();

      const pending = capturedQueue!.getPending();
      expect(pending).toHaveLength(1);

      const change = pending[0] as PendingAdd;
      expect(change.id).toBeDefined();
      expect(typeof change.id).toBe('string');
      expect(change.id.length).toBeGreaterThan(0);
      expect(change.timestamp).toBeGreaterThanOrEqual(beforeEnqueue);
      expect(change.timestamp).toBeLessThanOrEqual(afterEnqueue);
    });
  });
});