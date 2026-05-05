import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { type ShoppingList, type ListItem as ListItemType } from '../types';
import apiClient, { generateShareLink } from '../api/client';
import Header from '../components/Header';
import ListItem from '../components/ListItem';
import ItemForm from '../components/ItemForm';
import ListForm from '../components/ListForm';
import ShareModal from '../components/ShareModal';

const ListDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const initialFetchDone = useRef(false);

  const fetchList = useCallback(async (): Promise<void> => {
    try {
      setLoadingList(true);
      const response = await apiClient.get<ShoppingList>(`/lists/${id}`);
      setList(response.data);
    } catch (err) {
      console.error('Failed to fetch list:', err);
      setError('Failed to load list');
    } finally {
      setLoadingList(false);
    }
  }, [id]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && id && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchList();
    }
  }, [isAuthenticated, id, fetchList]);

  const handleAddItem = async (name: string, quantity: number): Promise<void> => {
    if (!list) return;

    try {
      const response = await apiClient.post<ListItemType>(`/lists/${list.id}/items`, {
        name,
        quantity,
      });
      setList({
        ...list,
        items: [...(list.items ?? []), response.data],
      });
    } catch (err) {
      console.error('Failed to add item:', err);
      setError('Failed to add item');
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

    try {
      await apiClient.put(`/items/${itemId}`, {
        is_checked: isChecked,
      });
    } catch (err: unknown) {
      console.error('Failed to update item:', err);
      setError('Failed to update item');
      // Revert on error
      setList(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: (prev.items ?? []).map(item =>
            item.id === itemId ? { ...item, is_checked: !isChecked } : item
          )
        };
      });
    }
  };

  const handleDeleteItem = async (itemId: string): Promise<void> => {
    if (!list) return;

    try {
      await apiClient.delete(`/items/${itemId}`);
      setList({
        ...list,
        items: (list.items ?? []).filter((item) => item.id !== itemId),
      });
    } catch (err) {
      console.error('Failed to delete item:', err);
      setError('Failed to delete item');
    }
  };

const handleEditItem = async (itemId: string, name: string, quantity: number): Promise<void> => {
    if (!list) return;

    // Store original item for revert
    const originalItem = (list.items ?? []).find((item) => item.id === itemId);
    
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

    try {
      await apiClient.put(`/items/${itemId}`, { name, quantity });
    } catch (err: unknown) {
      console.error('Failed to edit item:', err);
      setError('Failed to edit item');
      // Revert on error
      if (originalItem) {
        setList(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: (prev.items ?? []).map(item =>
              item.id === itemId ? originalItem : item
            )
          };
        });
      }
    }
  };

  const handleUpdateList = async (name: string): Promise<void> => {
    if (!list) return;

    try {
      const response = await apiClient.put<ShoppingList>(`/lists/${list.id}`, {
        name,
      });
      setList(response.data);
      setShowEditForm(false);
    } catch (err) {
      console.error('Failed to update list:', err);
      setError('Failed to update list');
    }
  };

  const handleGenerateShareLink = async (): Promise<string | null> => {
    if (!list) return null;

    try {
      const shareCode = await generateShareLink(list.id);
      setList((prev) => prev ? { ...prev, share_code: shareCode } : null);
      return shareCode;
    } catch (err) {
      console.error('Failed to generate share link:', err);
      setError('Failed to generate share link');
      return null;
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="page">
        <Header />
        <div className="loading-container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (loadingList) {
    return (
      <div className="page">
        <Header />
        <div className="loading-container">
          <div className="loading">Loading list...</div>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="page">
        <Header />
        <div className="loading-container">
          <div className="error-message">List not found</div>
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
        <div className="page-header page-header--compact">
          <button onClick={() => navigate('/')} className="btn btn-back">
            ← Back
          </button>
          <h1 className="page-title">{list.name}</h1>
          <button
            onClick={() => setShowShareModal(true)}
            className="btn btn-secondary"
          >
            Share
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)} className="error-close">
              ×
            </button>
          </div>
        )}

        {showEditForm ? (
          <div className="card form-card">
            <ListForm
              initialData={list}
              onSubmit={handleUpdateList}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowEditForm(true)}
            className="btn btn-link edit-list-btn"
          >
            Edit list name
          </button>
        )}

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

        <ShareModal
          isOpen={showShareModal}
          shareCode={list.share_code}
          onClose={() => setShowShareModal(false)}
          onGenerateShareLink={handleGenerateShareLink}
        />
      </main>
    </div>
  );
};

export default ListDetail;