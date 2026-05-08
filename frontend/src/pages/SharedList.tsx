import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { type ShoppingList, type ListItem as ListItemType } from '../types';
import { useApiHealthContext } from '../context/useApiHealthContext';
import apiClient, { apiClientNoRedirect } from '../api/client';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import Header from '../components/Header';
import ListItem from '../components/ListItem';
import ItemForm from '../components/ItemForm';

const SharedList: React.FC = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const { isConnected } = useApiHealthContext();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialFetchDone = useRef(false);
  const prevConnectedRef = useRef(isConnected);
  const syncAttemptedRef = useRef(false);

  const { enqueue, getPending, dequeue } = useOfflineQueue(shareCode ?? '');

  const fetchSharedList = useCallback(async (): Promise<void> => {
    try {
      setLoadingList(true);
      const response = await apiClient.get<ShoppingList>(`/lists/shared/${shareCode}`);
      setList(response.data);
    } catch (err) {
      console.error('Failed to fetch shared list:', err);
      setError('List not found or is not public');
    } finally {
      setLoadingList(false);
    }
  }, [shareCode]);

  const syncPendingChanges = useCallback(async (): Promise<void> => {
    const pending = getPending();
    if (pending.length === 0 || !shareCode || !list?.id) return;

    const tempIdMap: Record<string, string> = {};

    for (const change of pending) {
      try {
        switch (change.type) {
          case 'add': {
            const response = await apiClientNoRedirect.post<ListItemType>(
              `/lists/${list.id}/items`,
              { name: change.name, quantity: change.quantity },
              { params: { share_code: shareCode } }
            );
            tempIdMap[change.tempId] = response.data.id;
            setList(prev => {
              if (!prev) return prev;
              const items = prev.items ?? [];
              const existingIndex = items.findIndex(item => item.id === change.tempId);
              if (existingIndex >= 0) {
                const newItems = [...items];
                newItems[existingIndex] = response.data;
                return { ...prev, items: newItems };
              }
              return { ...prev, items: [...items, response.data] };
            });
            break;
          }
          case 'toggle': {
            const realId = tempIdMap[change.itemId] || change.itemId;
            await apiClientNoRedirect.put(`/items/${realId}`, {
              is_checked: change.is_checked,
            }, { params: { share_code: shareCode } });
            break;
          }
          case 'edit': {
            const realId = tempIdMap[change.itemId] || change.itemId;
            await apiClientNoRedirect.put(`/items/${realId}`, {
              name: change.name,
              quantity: change.quantity,
            }, { params: { share_code: shareCode } });
            break;
          }
          case 'delete': {
            const realId = tempIdMap[change.itemId] || change.itemId;
            await apiClientNoRedirect.delete(`/items/${realId}`, {
              params: { share_code: shareCode },
            });
            break;
          }
        }
        dequeue(change.id);
      } catch (err: unknown) {
        // Check if this is an HTTP error with a status code
        const httpStatus =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response: { status: number } }).response?.status
            : undefined;

        if (httpStatus === 404) {
          // Item was deleted by another user — remove from queue and continue
          console.warn('Item not found (likely deleted), removing from queue:', change);
          dequeue(change.id);
          continue;
        }

        if (httpStatus === 401) {
          // Auth token expired — notify user and stop
          console.error('Authentication failed during sync:', err);
          return;
        }

        // Transient error (network, 500, etc.) — stop and retry later
        console.error('Failed to sync pending change, will retry later:', err, change);
        return;
      }
    }

    // After all changes synced, re-fetch to reconcile state
    await fetchSharedList();
  }, [shareCode, getPending, dequeue, list, fetchSharedList]);

  useEffect(() => {
    if (shareCode && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchSharedList();
    }
  }, [shareCode, fetchSharedList]);

  // Sync pending changes when coming back online
  useEffect(() => {
    const wasOffline = !prevConnectedRef.current;
    prevConnectedRef.current = isConnected;

    if (wasOffline && isConnected) {
      syncPendingChanges();
    }
  }, [isConnected, syncPendingChanges]);

  // Sync pending changes once after initial list load
  useEffect(() => {
    if (!loadingList && list && isConnected && !syncAttemptedRef.current) {
      syncAttemptedRef.current = true;
      syncPendingChanges();
    }
  }, [loadingList, list, isConnected, syncPendingChanges]);

  const handleAddItem = async (name: string, quantity: number): Promise<void> => {
    if (!list) return;

    // Local-only temporary ID
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newItem: ListItemType = {
      id: tempId,
      list_id: list.id,
      name,
      quantity,
      is_checked: false,
      sort_order: (list.items ?? []).length,
      created_at: new Date().toISOString(),
    };

    // Update UI immediately
    setList(prev => {
      if (!prev) return prev;
      return { ...prev, items: [...(prev.items ?? []), newItem] };
    });

    // Fire API in background — no revert on failure
    if (isConnected) {
      try {
        const response = await apiClientNoRedirect.post<ListItemType>(`/lists/${list.id}/items`, {
          name,
          quantity,
        }, {
          params: { share_code: shareCode },
        });
        // Replace temp ID with real one from server
        setList(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: (prev.items ?? []).map(item =>
              item.id === tempId ? response.data : item
            ),
          };
        });
      } catch (err: unknown) {
        console.error('Failed to add item:', err);
        enqueue({ type: 'add', tempId, name, quantity });
      }
    } else {
      // Queue the change for later sync
      enqueue({
        type: 'add',
        tempId,
        name,
        quantity,
      });
    }
  };

  const handleToggleItem = async (
    itemId: string,
    isChecked: boolean
  ): Promise<void> => {
    if (!list) return;

    // Optimistically update UI using functional state
    setList(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: (prev.items ?? []).map(item =>
          item.id === itemId ? { ...item, is_checked: isChecked } : item
        )
      };
    });

    // Fire API in background if connected
    if (isConnected) {
      try {
        await apiClientNoRedirect.put(`/items/${itemId}`, {
          is_checked: isChecked,
        }, {
          params: { share_code: shareCode },
        });
      } catch (err: unknown) {
        console.error('Failed to update item:', err);
        enqueue({ type: 'toggle', itemId, is_checked: isChecked });
      }
    } else {
      // Queue the change for later sync
      enqueue({
        type: 'toggle',
        itemId,
        is_checked: isChecked,
      });
    }
  };

const handleDeleteItem = async (itemId: string): Promise<void> => {
  if (!list) return;

  // Remove item from local state immediately
  setList(prev => {
    if (!prev) return prev;
    return {
      ...prev,
      items: (prev.items ?? []).filter((item) => item.id !== itemId),
    };
  });

// Fire API in background
    if (isConnected) {
      try {
        await apiClientNoRedirect.delete(`/items/${itemId}`, {
          params: { share_code: shareCode },
        });
      } catch (err: unknown) {
        console.error('Failed to delete item:', err);
        enqueue({ type: 'delete', itemId });
      }
    } else {
      // Queue the change for later sync
      enqueue({
        type: 'delete',
        itemId,
      });
    }
  };

const handleEditItem = async (itemId: string, name: string, quantity: number): Promise<void> => {
    if (!list) return;

    // Optimistically update UI using functional state
    setList(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: (prev.items ?? []).map(item =>
          item.id === itemId ? { ...item, name, quantity } : item
        )
      };
    });

    // Fire API in background if connected
    if (isConnected) {
      try {
        await apiClientNoRedirect.put(`/items/${itemId}`, { name, quantity }, {
          params: { share_code: shareCode },
        });
      } catch (err: unknown) {
        console.error('Failed to edit item:', err);
        enqueue({ type: 'edit', itemId, name, quantity });
      }
    } else {
      // Queue the change for later sync
      enqueue({
        type: 'edit',
        itemId,
        name,
        quantity,
      });
    }
  };

  if (loadingList) {
    return (
      <div className="page">
        <Header />
        <div className="loading-container">
          <div className="loading">Loading shared list...</div>
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="page">
        <Header />
        <div className="loading-container">
          <div className="error-message">{error || 'List not found'}</div>
        </div>
      </div>
    );
  }

  const checkedCount = (list.items ?? []).filter((item) => item.is_checked).length;
  const totalCount = (list.items ?? []).length;

  return (
    <div className="page">
      <Header />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title">{list.name}</h1>
          <span className="badge badge-shared">Shared List</span>
        </div>

        <div className="list-progress">
          <span>
            {checkedCount} of {totalCount} items checked
          </span>
          {totalCount > 0 && (
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(checkedCount / totalCount) * 100}%` }}
              ></div>
            </div>
          )}
        </div>

        <div className="items-list">
          <ItemForm onSubmit={handleAddItem} />

          {(list.items ?? []).length === 0 ? (
            <div className="empty-state">
              <p>No items in this list.</p>
              <p>Add your first item above!</p>
            </div>
          ) : (
            (list.items ?? [])
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <ListItem
                  key={item.id}
                  item={item}
                  onToggle={handleToggleItem}
                  onDelete={handleDeleteItem}
                  onEdit={handleEditItem}
                />
              ))
          )}
        </div>
      </main>
    </div>
  );
};

export default SharedList;