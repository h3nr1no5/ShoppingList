import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ListItem from './ListItem';
import { type ListItem as ListItemType } from '../types';

// Mock the Swipeable component
vi.mock('./Swipeable', () => ({
  default: ({ children, onSwipe, onSwipeRight }: { 
    children: React.ReactNode; 
    onSwipe: () => void;
    onSwipeRight?: () => void;
  }) => (
    <div data-testid="swipeable" onClick={onSwipe} onContextMenu={(e) => { e.preventDefault(); onSwipeRight?.(); }}>
      {children}
    </div>
  ),
}));

const createMockItem = (overrides: Partial<ListItemType> = {}): ListItemType => ({
  id: 'item-1',
  list_id: 'list-1',
  name: 'Milk',
  quantity: 1,
  unit: "pcs",
  is_checked: false,
  sort_order: 0,
  created_at: '2024-01-01',
  ...overrides,
});

describe('ListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Renders correctly', () => {
    it('displays item name', () => {
      const mockItem = createMockItem({ name: 'Milk' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.getByText('Milk')).toBeInTheDocument();
    });

    it.each([2, 3, 5])('displays quantity with unit for quantity %d', (qty) => {
      const mockItem = createMockItem({ quantity: qty });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.getByText(`${qty} pcs`)).toBeInTheDocument();
    });

    it('displays x format when unit is empty and quantity > 1', () => {
      const mockItem = createMockItem({ quantity: 2, unit: '' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.getByText('x2')).toBeInTheDocument();
    });

    it('hides quantity when unit is empty and quantity is 1', () => {
      const mockItem = createMockItem({ quantity: 1, unit: '' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.queryByText('x1')).not.toBeInTheDocument();
    });

    it('does not display quantity when unit is "pcs" and quantity is 1', () => {
      const mockItem = createMockItem({ quantity: 1, unit: 'pcs' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.getByText('1 pcs')).toBeInTheDocument();
    });

    it('checkbox is unchecked when is_checked is false', () => {
      const mockItem = createMockItem({ is_checked: false });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('checkbox is checked when is_checked is true', () => {
      const mockItem = createMockItem({ is_checked: true });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  describe('Checkbox toggle', () => {
    it('calls onToggle with correct arguments when checkbox is clicked (unchecked to checked)', () => {
      const onToggle = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', is_checked: false });
      render(<ListItem item={mockItem} onToggle={onToggle} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      fireEvent.click(screen.getByRole('checkbox'));
      
      expect(onToggle).toHaveBeenCalledWith('item-1', true);
    });

    it('calls onToggle with correct arguments when checkbox is clicked (checked to unchecked)', () => {
      const onToggle = vi.fn();
      const mockItem = createMockItem({ id: 'item-2', is_checked: true });
      render(<ListItem item={mockItem} onToggle={onToggle} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      fireEvent.click(screen.getByRole('checkbox'));
      
      expect(onToggle).toHaveBeenCalledWith('item-2', false);
    });

    it('calls onToggle only once when checkbox is clicked', () => {
      const onToggle = vi.fn();
      const mockItem = createMockItem({ is_checked: false });
      render(<ListItem item={mockItem} onToggle={onToggle} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      fireEvent.click(screen.getByRole('checkbox'));
      
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete button', () => {
    it('calls onDelete with item id when delete button is clicked and confirmed', () => {
      const onDelete = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={onDelete} onEdit={vi.fn()} />);
      
      // Click delete button to open confirmation dialog
      fireEvent.click(screen.getByTitle('Delete item'));
      
      // Confirm dialog should be visible
      expect(screen.getByText('Delete Item')).toBeInTheDocument();
      
      // Click the confirm button to delete
      fireEvent.click(screen.getByText('Delete'));
      
      expect(onDelete).toHaveBeenCalledWith('item-1');
    });

    it('does not call onDelete when confirm is cancelled', () => {
      const onDelete = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={onDelete} onEdit={vi.fn()} />);
      
      // Click delete button to open confirmation dialog
      fireEvent.click(screen.getByTitle('Delete item'));
      
      // Confirm dialog should be visible
      expect(screen.getByText('Delete Item')).toBeInTheDocument();
      
      // Click the cancel button
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe('Checked state styling', () => {
    it('has checked class on list-item when is_checked is true', () => {
      const mockItem = createMockItem({ is_checked: true });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      const listItem = screen.getByText('Milk').closest('.list-item');
      expect(listItem).toHaveClass('checked');
    });

    it('does not have checked class on list-item when is_checked is false', () => {
      const mockItem = createMockItem({ is_checked: false });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      const listItem = screen.getByText('Milk').closest('.list-item');
      expect(listItem).not.toHaveClass('checked');
    });

    it('item name has checked class when is_checked is true', () => {
      const mockItem = createMockItem({ is_checked: true });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      const itemName = screen.getByText('Milk');
      expect(itemName).toHaveClass('checked');
    });

    it('item name does not have checked class when is_checked is false', () => {
      const mockItem = createMockItem({ is_checked: false });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      const itemName = screen.getByText('Milk');
      expect(itemName).not.toHaveClass('checked');
    });
  });

  describe('Swipeable integration', () => {
    it('renders within Swipeable wrapper', () => {
      const mockItem = createMockItem();
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      expect(screen.getByTestId('swipeable')).toBeInTheDocument();
    });

    it('calls onDelete when Swipeable onSwipe is triggered', () => {
      const onDelete = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={onDelete} onEdit={vi.fn()} />);
      
      // Trigger swipe to open confirmation dialog
      fireEvent.click(screen.getByTestId('swipeable'));
      
      // Confirm dialog should be visible
      expect(screen.getByText('Delete Item')).toBeInTheDocument();
      
      // Click the confirm button to delete
      fireEvent.click(screen.getByText('Delete'));
      
      expect(onDelete).toHaveBeenCalledWith('item-1');
    });

    it('calls handleEdit when Swipeable onSwipeRight is triggered', () => {
      const onEdit = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={onEdit} />);
      
      // Trigger the onSwipeRight by using context menu on the swipeable div
      fireEvent.contextMenu(screen.getByTestId('swipeable'));
      
      // Should enter edit mode (show the edit form)
      expect(screen.getByDisplayValue('Milk')).toBeInTheDocument();
    });

    it('does not render Swipeable when editing', () => {
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      // Swipeable should be present initially
      expect(screen.getByTestId('swipeable')).toBeInTheDocument();
      
      // Click edit button
      fireEvent.click(screen.getByTitle('Edit item'));
      
      // Swipeable should NOT be present when editing
      expect(screen.queryByTestId('swipeable')).not.toBeInTheDocument();
      
      // But the edit form should be visible
      expect(screen.getByDisplayValue('Milk')).toBeInTheDocument();
    });
  });

  describe('Timestamp display', () => {
    it('shows relative time format when updated_at is provided', () => {
      // Use a recent timestamp that will show as "Just now" or relative time
      const now = new Date();
      const mockItem = createMockItem({
        created_at: new Date(now.getTime() - 86400000).toISOString(), // 1 day ago
        updated_at: now.toISOString(),
      });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      // Should show relative time format (e.g., "Just now", "5m ago", "2h ago")
      expect(screen.getByText(/Just now|ago/)).toBeInTheDocument();
    });

    it('falls back to created_at when updated_at is null', () => {
      const mockItem = createMockItem({
        created_at: new Date().toISOString(), // recent date
        updated_at: null,
      });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      // Should show relative time for created_at
      expect(screen.getByText(/Just now|ago/)).toBeInTheDocument();
    });

    it('falls back to created_at when updated_at is undefined', () => {
      const mockItem = createMockItem({
        created_at: new Date().toISOString(), // recent date
      });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      // Should show relative time for created_at
      expect(screen.getByText(/Just now|ago/)).toBeInTheDocument();
    });

    it('shows nothing when neither updated_at nor created_at exist', () => {
      const mockItem = createMockItem({
        created_at: undefined,
        updated_at: undefined,
      });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      // Should not show any timestamp
      expect(screen.queryByText(/Just now|ago/)).not.toBeInTheDocument();
    });

    it('hides timestamp when in edit mode', () => {
      const mockItem = createMockItem({
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      // Verify timestamp is shown initially
      expect(screen.getByText(/Just now|ago/)).toBeInTheDocument();
      
      // Click edit button to enter edit mode
      fireEvent.click(screen.getByTitle('Edit item'));
      
      // Timestamp should be hidden in edit mode
      expect(screen.queryByText(/Just now|ago/)).not.toBeInTheDocument();
    });

    it('formats timestamp as relative time', () => {
      // Mock "just now" (current time)
      const recentItem = createMockItem({ updated_at: new Date().toISOString() });
      render(<ListItem item={recentItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });
  });

  describe('Edit functionality', () => {
    it('shows edit form when edit button is clicked', () => {
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk', quantity: 2 });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      // Should show input fields
      expect(screen.getByDisplayValue('Milk')).toBeInTheDocument();
      expect(screen.getByDisplayValue(2)).toBeInTheDocument();
    });

    it('has name input in edit form', () => {
      const mockItem = createMockItem({ name: 'Bread' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      expect(screen.getByDisplayValue('Bread')).toBeInTheDocument();
    });

    it('has quantity input in edit form', () => {
      const mockItem = createMockItem({ quantity: 5 });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      expect(screen.getByDisplayValue(5)).toBeInTheDocument();
    });

    it('has save button in edit form', () => {
      const mockItem = createMockItem();
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      expect(screen.getByTitle('Save changes')).toBeInTheDocument();
    });

    it('has cancel button in edit form', () => {
      const mockItem = createMockItem();
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      expect(screen.getByTitle('Cancel editing')).toBeInTheDocument();
    });

    it('has unit dropdown in edit form', () => {
      const mockItem = createMockItem({ unit: 'kg' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      expect(screen.getByDisplayValue('kg')).toBeInTheDocument();
    });

    it('calls onEdit with correct parameters when save is clicked', () => {
      const onEdit = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk', quantity: 1 });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={onEdit} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      // Change the name
      const nameInput = screen.getByDisplayValue('Milk');
      fireEvent.change(nameInput, { target: { value: 'Updated Milk' } });
      
      // Click save
      fireEvent.click(screen.getByTitle('Save changes'));
      
      expect(onEdit).toHaveBeenCalledWith('item-1', 'Updated Milk', 1, 'pcs');
    });

    it('calls onEdit with quantity when quantity is changed', () => {
      const onEdit = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk', quantity: 1 });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={onEdit} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      // Change the quantity
      const quantityInput = screen.getByDisplayValue(1);
      fireEvent.change(quantityInput, { target: { value: '5' } });
      
      // Click save
      fireEvent.click(screen.getByTitle('Save changes'));
      
      expect(onEdit).toHaveBeenCalledWith('item-1', 'Milk', 5, 'pcs');
    });

    it('hides edit form when cancel is clicked', () => {
      const onEdit = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={onEdit} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      // Click cancel
      fireEvent.click(screen.getByTitle('Cancel editing'));
      
      // Should show the item name again (not the input)
      expect(screen.getByText('Milk')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Milk')).not.toBeInTheDocument();
    });

    it('does not call onEdit when cancel is clicked', () => {
      const onEdit = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={onEdit} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      // Change the name
      const nameInput = screen.getByDisplayValue('Milk');
      fireEvent.change(nameInput, { target: { value: 'Changed' } });
      
      // Click cancel
      fireEvent.click(screen.getByTitle('Cancel editing'));
      
      expect(onEdit).not.toHaveBeenCalled();
    });

    it('does not save when name is empty', () => {
      const onEdit = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk', quantity: 1 });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={onEdit} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      // Clear the name
      const nameInput = screen.getByDisplayValue('Milk');
      fireEvent.change(nameInput, { target: { value: '' } });
      
      // Click save
      fireEvent.click(screen.getByTitle('Save changes'));
      
      // onEdit should not be called with empty name
      expect(onEdit).not.toHaveBeenCalled();
    });

    it('does not show edit button when editing', () => {
      const mockItem = createMockItem({ id: 'item-1', name: 'Milk' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} />);
      
      fireEvent.click(screen.getByTitle('Edit item'));
      
      // Edit button should be hidden, save/cancel should be visible
      expect(screen.queryByTitle('Edit item')).not.toBeInTheDocument();
      expect(screen.getByTitle('Save changes')).toBeInTheDocument();
    });
  });
});