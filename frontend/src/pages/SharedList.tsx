import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { type ShoppingList, type ListItem as ListItemType } from '../types';
import apiClient from '../api/client';
import Header from '../components/Header';
import ListItem from '../components/ListItem';
import ItemForm from '../components/ItemForm';

const SharedList: React.FC = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shareCode) {
      fetchSharedList();
    }
  }, [shareCode]);

  const fetchSharedList = async (): Promise<void> => {
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
  };

  const handleAddItem = async (name: string, quantity: number): Promise<void> => {
    if (!list) return;

    try {
      const response = await apiClient.post<ListItemType>(`/lists/${list.id}/items`, {
        name,
        quantity,
      }, {
        params: { share_code: shareCode },
      });
      setList({
        ...list,
        items: [...list.items, response.data],
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

    try {
      await apiClient.put(`/items/${itemId}`, {
        is_checked: isChecked,
      }, {
        params: { share_code: shareCode },
      });
      setList({
        ...list,
        items: list.items.map((item) =>
          item.id === itemId ? { ...item, is_checked: isChecked } : item
        ),
      });
    } catch (err) {
      console.error('Failed to update item:', err);
      setError('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string): Promise<void> => {
    if (!list) return;

    try {
      await apiClient.delete(`/items/${itemId}`, {
        params: { share_code: shareCode },
      });
      setList({
        ...list,
        items: list.items.filter((item) => item.id !== itemId),
      });
    } catch (err) {
      console.error('Failed to delete item:', err);
      setError('Failed to delete item');
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

  const checkedCount = list.items.filter((item) => item.is_checked).length;
  const totalCount = list.items.length;

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

          {list.items.length === 0 ? (
            <div className="empty-state">
              <p>No items in this list.</p>
              <p>Add your first item above!</p>
            </div>
          ) : (
            list.items
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <ListItem
                  key={item.id}
                  item={item}
                  onToggle={handleToggleItem}
                  onDelete={handleDeleteItem}
                />
              ))
          )}
        </div>
      </main>
    </div>
  );
};

export default SharedList;