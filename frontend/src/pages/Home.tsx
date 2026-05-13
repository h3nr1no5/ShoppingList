import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useToastContext } from '../context/useToastContext';
import { useApiHealthContext } from '../context/useApiHealthContext';
import { type ShoppingList } from '../types';
import apiClient from '../api/client';
import Header from '../components/Header';
import ShoppingListCard from '../components/ShoppingListCard';
import ListForm from '../components/ListForm';

const Home: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToastContext();
  const { isConnected } = useApiHealthContext();
  const navigate = useNavigate();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const initialFetchDone = useRef(false);

  const fetchLists = useCallback(async (): Promise<void> => {
    try {
      setLoadingLists(true);
      const response = await apiClient.get<ShoppingList[]>('/lists');
      setLists(response.data);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
      showToast(t('errors.failed_to_load_lists'), 'error');
    } finally {
      setLoadingLists(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchLists();
    }
  }, [isAuthenticated, fetchLists]);

  const handleCreateList = async (name: string): Promise<void> => {
    try {
      const response = await apiClient.post<ShoppingList>('/lists', {
        name,
      });
      setLists([...lists, response.data]);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to create list:', err);
      showToast(t('errors.failed_to_create_list'), 'error');
    }
  };

  const handleDeleteList = async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/lists/${id}`);
      setLists(lists.filter((list) => list.id !== id));
    } catch (err) {
      console.error('Failed to delete list:', err);
      showToast(t('errors.failed_to_delete_list'), 'error');
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="page">
        <Header />
        <div className="loading-container">
          <div className="loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Header />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title">{t('list.my_shopping_lists')}</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-primary"
            disabled={!isConnected}
          >
            {showForm ? t('common.cancel') : t('list.new_list')}
          </button>
        </div>

        {showForm && (
          <div className="card form-card">
            <ListForm onSubmit={handleCreateList} />
          </div>
        )}

        {loadingLists ? (
          <div className="loading-container">
            <div className="loading">{t('list.loading_lists')}</div>
          </div>
        ) : lists.length === 0 ? (
          <div className="empty-state">
            <p>{t('list.no_lists_yet')}</p>
            <p>{t('list.create_first_list')}</p>
          </div>
        ) : (
          <div className="lists-grid">
            {lists.map((list) => (
              <ShoppingListCard
                key={list.id}
                list={list}
                onDelete={handleDeleteList}
                disabled={!isConnected}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;