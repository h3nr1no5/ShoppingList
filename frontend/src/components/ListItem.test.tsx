import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ListItem from './ListItem';
import { type ListItem as ListItemType } from '../types';

// Mock the Swipeable component
vi.mock('./Swipeable', () => ({
  default: ({ children, onSwipe }: { children: React.ReactNode; onSwipe: () => void }) => (
    <div data-testid="swipeable" onClick={onSwipe}>{children}</div>
  ),
}));

const createMockItem = (overrides: Partial<ListItemType> = {}): ListItemType => ({
  id: 'item-1',
  list_id: 'list-1',
  name: 'Milk',
  quantity: 1,
  is_checked: false,
  sort_order: 0,
  created_at: '2024-01-01',
  ...overrides,
});

describe('ListItem', () => {
  const mockConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', mockConfirm);
  });

  describe('Renders correctly', () => {
    it('displays item name', () => {
      const mockItem = createMockItem({ name: 'Milk' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByText('Milk')).toBeInTheDocument();
    });

    it.each([2, 3, 5])('displays quantity when quantity is %d', (qty) => {
      const mockItem = createMockItem({ quantity: qty });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByText(`x${qty}`)).toBeInTheDocument();
    });

    it('does not display quantity when equal to 1', () => {
      const mockItem = createMockItem({ quantity: 1 });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.queryByText('x1')).not.toBeInTheDocument();
    });

    it('checkbox is unchecked when is_checked is false', () => {
      const mockItem = createMockItem({ is_checked: false });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('checkbox is checked when is_checked is true', () => {
      const mockItem = createMockItem({ is_checked: true });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  describe('Checkbox toggle', () => {
    it('calls onToggle with correct arguments when checkbox is clicked (unchecked to checked)', () => {
      const onToggle = vi.fn();
      const mockItem = createMockItem({ id: 'item-1', is_checked: false });
      render(<ListItem item={mockItem} onToggle={onToggle} onDelete={vi.fn()} />);
      
      fireEvent.click(screen.getByRole('checkbox'));
      
      expect(onToggle).toHaveBeenCalledWith('item-1', true);
    });

    it('calls onToggle with correct arguments when checkbox is clicked (checked to unchecked)', () => {
      const onToggle = vi.fn();
      const mockItem = createMockItem({ id: 'item-2', is_checked: true });
      render(<ListItem item={mockItem} onToggle={onToggle} onDelete={vi.fn()} />);
      
      fireEvent.click(screen.getByRole('checkbox'));
      
      expect(onToggle).toHaveBeenCalledWith('item-2', false);
    });

    it('calls onToggle only once when checkbox is clicked', () => {
      const onToggle = vi.fn();
      const mockItem = createMockItem({ is_checked: false });
      render(<ListItem item={mockItem} onToggle={onToggle} onDelete={vi.fn()} />);
      
      fireEvent.click(screen.getByRole('checkbox'));
      
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete button', () => {
    it('calls onDelete with item id when delete button is clicked and confirmed', () => {
      const onDelete = vi.fn();
      mockConfirm.mockReturnValue(true);
      const mockItem = createMockItem({ id: 'item-1' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={onDelete} />);
      
      fireEvent.click(screen.getByTitle('Delete item'));
      
      expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this item?');
      expect(onDelete).toHaveBeenCalledWith('item-1');
    });

    it('does not call onDelete when confirm is cancelled', () => {
      const onDelete = vi.fn();
      mockConfirm.mockReturnValue(false);
      const mockItem = createMockItem({ id: 'item-1' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={onDelete} />);
      
      fireEvent.click(screen.getByTitle('Delete item'));
      
      expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this item?');
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe('Checked state styling', () => {
    it('has checked class on list-item when is_checked is true', () => {
      const mockItem = createMockItem({ is_checked: true });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} />);
      
      const listItem = screen.getByText('Milk').closest('.list-item');
      expect(listItem).toHaveClass('checked');
    });

    it('does not have checked class on list-item when is_checked is false', () => {
      const mockItem = createMockItem({ is_checked: false });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} />);
      
      const listItem = screen.getByText('Milk').closest('.list-item');
      expect(listItem).not.toHaveClass('checked');
    });

    it('item name has checked class when is_checked is true', () => {
      const mockItem = createMockItem({ is_checked: true });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} />);
      
      const itemName = screen.getByText('Milk');
      expect(itemName).toHaveClass('checked');
    });

    it('item name does not have checked class when is_checked is false', () => {
      const mockItem = createMockItem({ is_checked: false });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} />);
      
      const itemName = screen.getByText('Milk');
      expect(itemName).not.toHaveClass('checked');
    });
  });

  describe('Swipeable integration', () => {
    it('renders within Swipeable wrapper', () => {
      const mockItem = createMockItem();
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={vi.fn()} />);
      
      expect(screen.getByTestId('swipeable')).toBeInTheDocument();
    });

    it('calls onDelete when Swipeable onSwipe is triggered', () => {
      const onDelete = vi.fn();
      mockConfirm.mockReturnValue(true);
      const mockItem = createMockItem({ id: 'item-1' });
      render(<ListItem item={mockItem} onToggle={vi.fn()} onDelete={onDelete} />);
      
      fireEvent.click(screen.getByTestId('swipeable'));
      
      expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this item?');
      expect(onDelete).toHaveBeenCalledWith('item-1');
    });
  });
});