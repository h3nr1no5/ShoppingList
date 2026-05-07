import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { type ShoppingList, type ListItem as ListItemType } from '../types';
import { useApiHealthContext } from '../context/ApiHealthContext';
import apiClient, { apiClientNoRedirect } from '../api/client';
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

  useEffect(() => {
    if (shareCode && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchSharedList();
    }
  }, [shareCode, fetchSharedList]);

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
        const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
        const detail = axiosErr.response?.data?.detail;
        console.error('Failed to add item:', { status: axiosErr.response?.status, detail });
        // Keep the item locally — no revert
      }
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
        const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
        const status = axiosErr.response?.status;
        const detail = axiosErr.response?.data?.detail;
        console.error('Failed to update item:', { status, detail, shareCode, itemId });
        if (status === 401) {
          setError('Not authorized. The share link may have expired.');
        } else if (status === 404) {
          setError('Item not found.');
        } else {
          setError(detail || 'Failed to update item');
        }
      }
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
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      const detail = axiosErr.response?.data?.detail;
      console.error('Failed to delete item:', { status: axiosErr.response?.status, detail });
      setError(detail || 'Failed to delete item');
    }
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
        const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
        const status = axiosErr.response?.status;
        const detail = axiosErr.response?.data?.detail;
        console.error('Failed to edit item:', { status, detail, shareCode, itemId });
        if (status === 401) {
          setError('Not authorized. The share link may have expired.');
        } else if (status === 404) {
          setError('Item not found.');
        } else {
          setError(detail || 'Failed to edit item');
        }
      }
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