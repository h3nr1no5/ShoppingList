import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ListDetail from './ListDetail';
import { type ShoppingList } from '../types';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { useToastContext } from '../context/useToastContext';
import { ApiHealthContext } from '../context/ApiHealthContext';
import { ToastContainer } from '../components/ToastContainer';

// Mock the apiClient
vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    default: {
      get: vi.fn(),
      put: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    },
    apiClientNoRedirect: {
      get: vi.fn(),
      put: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    },
    generateShareLink: vi.fn(),
  };
});

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
  };
});

import apiClient, { apiClientNoRedirect } from '../api/client';
import { useParams } from 'react-router-dom';

const mockApiClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const createMockList = (overrides: Partial<ShoppingList> = {}): ShoppingList => ({
  id: 'list-1',
  name: 'My Shopping List',
  owner_id: 'user-1',
  share_code: null,
  items: [
    {
      id: 'item-1',
      list_id: 'list-1',
      name: 'Milk',
      quantity: 2,
      is_checked: false,
      sort_order: 0,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'item-2',
      list_id: 'list-1',
      name: 'Bread',
      quantity: 1,
      is_checked: false,
      sort_order: 1,
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
});

const renderWithAuth = (
  ui: React.ReactElement,
  isAuthenticated = true,
  isConnected = true
) => {
  // Wrapper component to access toast context and render ToastContainer
  const ToastContainerWrapper: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => {
    const { toasts, dismissToast } = useToastContext();
    return (
      <>
        {children}
        <ToastContainer toasts={toasts} dismissToast={dismissToast} />
      </>
    );
  };

  return render(
    <BrowserRouter>
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
        <ToastProvider>
          <ToastContainerWrapper>
            <ApiHealthContext.Provider
              value={{
                status: isConnected ? 'connected' : 'disconnected',
                isConnected,
              }}
            >
              <AuthContext.Provider
                value={{
                  isAuthenticated,
                  user: isAuthenticated
                    ? { id: 'user-1', email: 'test@example.com' }
                    : null,
                  token: isAuthenticated ? 'mock-token' : null,
                  login: vi.fn(),
                  register: vi.fn(),
                  logout: vi.fn(),
                  loading: false,
                }}
              >
                {ui}
              </AuthContext.Provider>
            </ApiHealthContext.Provider>
          </ToastContainerWrapper>
        </ToastProvider>
      </ThemeContext.Provider>
    </BrowserRouter>
  );
};

describe('ListDetail - Offline Queue Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useParams).mockReturnValue({ id: 'list-1' });

    // Default mock for getting the list
    mockApiClient.get.mockResolvedValue({
      data: createMockList(),
    });
  });

  describe('When offline (isConnected: false)', () => {
    it('queues a toggle change when checkbox is clicked', async () => {
      renderWithAuth(<ListDetail />, true, false);

      // Wait for the list to load
      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      // Verify items are rendered
      expect(screen.getByText('Milk')).toBeInTheDocument();
      expect(screen.getByText('Bread')).toBeInTheDocument();

      // Click the checkbox for "Milk"
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      // Verify the optimistic UI update happened (checkbox is now checked)
      await waitFor(() => {
        expect(checkboxes[0]).toBeChecked();
      });

      // Verify the change was queued in localStorage
      const storageData = localStorage.getItem('pending_changes_list-1');
      expect(storageData).toBeDefined();
      const parsed = JSON.parse(storageData!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('toggle');
      expect(parsed[0].itemId).toBe('item-1');
      expect(parsed[0].is_checked).toBe(true);
    });

    it('queues an add change when adding an item', async () => {
      renderWithAuth(<ListDetail />, true, false);

      // Wait for the list to load
      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      // Find the add item form input and submit
      const addInput = screen.getByPlaceholderText(/add new item/i);
      fireEvent.change(addInput, { target: { value: 'Eggs' } });

      // Click the add button
      const addButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addButton);

      // Verify the change was queued in localStorage
      const storageData = localStorage.getItem('pending_changes_list-1');
      expect(storageData).toBeDefined();
      const parsed = JSON.parse(storageData!);
      expect(parsed.length).toBeGreaterThanOrEqual(1);

      // Find the add change
      const addChange = parsed.find((c: { type: string }) => c.type === 'add');
      expect(addChange).toBeDefined();
      expect(addChange.name).toBe('Eggs');
      expect(addChange.tempId).toContain('temp-');
    });

    it('queues a delete change when deleting an item', async () => {
      renderWithAuth(<ListDetail />, true, false);

      // Wait for the list to load
      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      // Click delete button on "Milk" to open confirmation
      const deleteButtons = screen.getAllByTitle('Delete item');
      fireEvent.click(deleteButtons[0]);

      // Confirm the deletion
      const confirmButton = screen.getByText('Delete');
      fireEvent.click(confirmButton);

      // Verify the delete was queued
      const storageData = localStorage.getItem('pending_changes_list-1');
      expect(storageData).toBeDefined();
      const parsed = JSON.parse(storageData!);
      expect(parsed.length).toBeGreaterThanOrEqual(1);

      const deleteChange = parsed.find(
        (c: { type: string }) => c.type === 'delete'
      );
      expect(deleteChange).toBeDefined();
      expect(deleteChange.itemId).toBe('item-1');
    });

    it('queues an edit change when editing an item', async () => {
      renderWithAuth(<ListDetail />, true, false);

      // Wait for the list to load
      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      // Click edit button on "Milk"
      const editButtons = screen.getAllByTitle('Edit item');
      fireEvent.click(editButtons[0]);

      // Change the name
      const nameInput = screen.getByDisplayValue('Milk');
      fireEvent.change(nameInput, { target: { value: 'Organic Milk' } });

      // Save
      const saveButton = screen.getByTitle('Save changes');
      fireEvent.click(saveButton);

      // Verify the edit was queued
      const storageData = localStorage.getItem('pending_changes_list-1');
      expect(storageData).toBeDefined();
      const parsed = JSON.parse(storageData!);
      expect(parsed.length).toBeGreaterThanOrEqual(1);

      const editChange = parsed.find(
        (c: { type: string }) => c.type === 'edit'
      );
      expect(editChange).toBeDefined();
      expect(editChange.itemId).toBe('item-1');
      expect(editChange.name).toBe('Organic Milk');
    });
  });

  describe('When online with API failure', () => {
    it('enqueues a toggle change when the API call fails', async () => {
      // Make apiClientNoRedirect.put reject to simulate network failure
      vi.mocked(apiClientNoRedirect.put).mockRejectedValue(
        new Error('Network error')
      );

      // Wait for the list to load with mock API
      renderWithAuth(<ListDetail />, true, true);

      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      // Click the checkbox for "Milk"
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      // The API call should fail, and the change should be enqueued locally
      await waitFor(
        () => {
          const storageData = localStorage.getItem('pending_changes_list-1');
          expect(storageData).toBeDefined();
          const parsed = JSON.parse(storageData!);
          expect(parsed.length).toBeGreaterThanOrEqual(1);
          const toggleChange = parsed.find(
            (c: { type: string }) => c.type === 'toggle'
          );
          expect(toggleChange).toBeDefined();
          expect(toggleChange.itemId).toBe('item-1');
          expect(toggleChange.is_checked).toBe(true);
        },
        { timeout: 5000 }
      );
    });
  });
});
