import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { type ShoppingList } from '../types';
import apiClient from '../api/client';
import Header from '../components/Header';
import ShoppingListCard from '../components/ShoppingListCard';
import ListForm from '../components/ListForm';

const Home: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialFetchDone = useRef(false);

  const fetchLists = useCallback(async (): Promise<void> => {
    try {
      setLoadingLists(true);
      const response = await apiClient.get<ShoppingList[]>('/lists');
      setLists(response.data);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
      setError('Failed to load lists');
    } finally {
      setLoadingLists(false);
    }
  }, []);

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
      setError('Failed to create list');
    }
  };

  const handleDeleteList = async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/lists/${id}`);
      setLists(lists.filter((list) => list.id !== id));
    } catch (err) {
      console.error('Failed to delete list:', err);
      setError('Failed to delete list');
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

  return (
    <div className="page">
      <Header />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title">My Shopping Lists</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-primary"
          >
            {showForm ? 'Cancel' : '+ New List'}
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

        {showForm && (
          <div className="card form-card">
            <ListForm onSubmit={handleCreateList} />
          </div>
        )}

        {loadingLists ? (
          <div className="loading-container">
            <div className="loading">Loading lists...</div>
          </div>
        ) : lists.length === 0 ? (
          <div className="empty-state">
            <p>No shopping lists yet.</p>
            <p>Create your first list to get started!</p>
          </div>
        ) : (
          <div className="lists-grid">
            {lists.map((list) => (
              <ShoppingListCard
                key={list.id}
                list={list}
                onDelete={handleDeleteList}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;