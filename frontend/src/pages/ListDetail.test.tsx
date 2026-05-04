import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, SpyInstance } from 'vitest';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ListDetail from './ListDetail';
import { type ShoppingList } from '../types';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

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

// Import the mocked modules
import apiClient from '../api/client';
import { useParams, useNavigate } from 'react-router-dom';

const mockApiClient = apiClient as unknown as {
  get: SpyInstance;
  put: SpyInstance;
  post: SpyInstance;
  delete: SpyInstance;
};

const createMockList = (overrides: Partial<ShoppingList> = {}): ShoppingList => ({
  id: 'list-1',
  name: 'My Shopping List',
  owner_id: 'user-1',
  share_code: null,
  items: [],
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
});

const renderWithAuth = (ui: React.ReactElement, isAuthenticated = true) => {
  return render(
    <BrowserRouter>
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
        <AuthContext.Provider
          value={{
            isAuthenticated,
            user: isAuthenticated ? { id: 'user-1', email: 'test@example.com' } : null,
            token: isAuthenticated ? 'mock-token' : null,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
            loading: false,
          }}
        >
          {ui}
        </AuthContext.Provider>
      </ThemeContext.Provider>
    </BrowserRouter>
  );
};

describe('ListDetail - Edit List Name', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({ id: 'list-1' });
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    
    // Default mock for getting the list
    mockApiClient.get.mockResolvedValue({
      data: createMockList(),
    });
  });

  describe('Edit list name', () => {
    it('shows edit button when list is loaded', async () => {
      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /edit list name/i })).toBeInTheDocument();
    });

    it('can edit list name', async () => {
      const updatedList = createMockList({ name: 'Updated List Name' });
      mockApiClient.put.mockResolvedValue({ data: updatedList });

      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      // Click edit button
      fireEvent.click(screen.getByRole('button', { name: /edit list name/i }));

      // Should show the form with input
      expect(screen.getByLabelText(/list name/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('My Shopping List')).toBeInTheDocument();

      // Change the name
      const nameInput = screen.getByDisplayValue('My Shopping List');
      fireEvent.change(nameInput, { target: { value: 'Updated List Name' } });

      // Click update button
      fireEvent.click(screen.getByRole('button', { name: /update list/i }));

      // Verify API was called
      await waitFor(() => {
        expect(mockApiClient.put).toHaveBeenCalledWith('/lists/list-1', {
          name: 'Updated List Name',
        });
      });

      // Verify the list name updates in the UI
      await waitFor(() => {
        expect(screen.getByText('Updated List Name')).toBeInTheDocument();
      });
    });

    it('cancel edit list name reverts to original', async () => {
      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      // Click edit button
      fireEvent.click(screen.getByRole('button', { name: /edit list name/i }));

      // Change the name
      const nameInput = screen.getByDisplayValue('My Shopping List');
      fireEvent.change(nameInput, { target: { value: 'Changed Name' } });

      // Click cancel button
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // Verify API was NOT called
      expect(mockApiClient.put).not.toHaveBeenCalled();

      // Verify the name reverted to original
      expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Changed Name')).not.toBeInTheDocument();
    });

    it('shows error message when edit fails', async () => {
      mockApiClient.put.mockRejectedValue(new Error('Network error'));

      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      // Click edit button
      fireEvent.click(screen.getByRole('button', { name: /edit list name/i }));

      // Change the name
      const nameInput = screen.getByDisplayValue('My Shopping List');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      // Click update button
      fireEvent.click(screen.getByRole('button', { name: /update list/i }));

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText(/failed to update list/i)).toBeInTheDocument();
      });
    });

    it('does not submit empty name', async () => {
      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      // Click edit button
      fireEvent.click(screen.getByRole('button', { name: /edit list name/i }));

      // Clear the name
      const nameInput = screen.getByDisplayValue('My Shopping List');
      fireEvent.change(nameInput, { target: { value: '' } });

      // Click update button
      fireEvent.click(screen.getByRole('button', { name: /update list/i }));

      // Verify API was NOT called
      expect(mockApiClient.put).not.toHaveBeenCalled();
    });

    it('hides edit button when edit form is shown', async () => {
      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByText('My Shopping List')).toBeInTheDocument();
      });

      // Click edit button
      fireEvent.click(screen.getByRole('button', { name: /edit list name/i }));

      // Edit button should be hidden
      expect(screen.queryByRole('button', { name: /edit list name/i })).not.toBeInTheDocument();

      // Form should be visible
      expect(screen.getByLabelText(/list name/i)).toBeInTheDocument();
    });
  });

  describe('Authentication and navigation', () => {
    it('redirects to login when not authenticated', async () => {
      renderWithAuth(<ListDetail />, false);

      // Should not show the list
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });

    it('shows loading state while fetching list', async () => {
      // Delay the response
      mockApiClient.get.mockImplementation(() => new Promise(() => {}));

      renderWithAuth(<ListDetail />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows error when list is not found', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Not found'));

      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByText(/list not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('List with different ownership', () => {
    it('shows edit button for list owned by current user', async () => {
      const ownedList = createMockList({ owner_id: 'user-1' });
      mockApiClient.get.mockResolvedValue({ data: ownedList });

      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit list name/i })).toBeInTheDocument();
      });
    });

    it('shows edit button for list with no owner (anonymous list)', async () => {
      const anonymousList = createMockList({ owner_id: null });
      mockApiClient.get.mockResolvedValue({ data: anonymousList });

      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit list name/i })).toBeInTheDocument();
      });
    });

    it('shows edit button for shared list', async () => {
      const sharedList = createMockList({ owner_id: 'user-2', share_code: 'abc123' });
      mockApiClient.get.mockResolvedValue({ data: sharedList });

      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit list name/i })).toBeInTheDocument();
      });
    });
  });

  describe('Back button and share button', () => {
    it('has back button that navigates to home', async () => {
      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /back/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('has share button', async () => {
      renderWithAuth(<ListDetail />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
      });
    });
  });

  describe('Handling missing items', () => {
    it('renders without crashing when items is undefined', async () => {
      // Mock the API to return a list WITHOUT items (matching actual API behavior)
      mockApiClient.get.mockResolvedValue({
        data: {
          id: 'list-1',
          name: 'Test List',
          owner_id: 'user-1',
          share_code: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          // Intentionally NOT including items
        } as ShoppingList,
      });

      renderWithAuth(<ListDetail />);

      // Should render without crashing - verify list name is displayed
      await waitFor(() => {
        expect(screen.getByText('Test List')).toBeInTheDocument();
      });

      // Should show "No items in this list." message
      expect(screen.getByText('No items in this list.')).toBeInTheDocument();
    });

    it('renders without crashing when items is null', async () => {
      // Mock the API to return a list with items set to null
      mockApiClient.get.mockResolvedValue({
        data: {
          id: 'list-1',
          name: 'Test List',
          owner_id: 'user-1',
          share_code: null,
          items: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        } as ShoppingList,
      });

      renderWithAuth(<ListDetail />);

      // Should render without crashing - verify list name is displayed
      await waitFor(() => {
        expect(screen.getByText('Test List')).toBeInTheDocument();
      });

      // Should show "No items in this list." message
      expect(screen.getByText('No items in this list.')).toBeInTheDocument();
    });
  });
});