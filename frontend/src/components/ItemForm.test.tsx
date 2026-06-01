import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ItemForm from './ItemForm';

// Initialize i18n so useTranslation works (ItemForm doesn't import i18n directly)
import '../i18n/i18n';

describe('ItemForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders an input field, a submit button, and a unit dropdown', () => {
      render(<ItemForm onSubmit={vi.fn()} />);

      expect(screen.getByPlaceholderText('Add new item...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
      expect(screen.getByLabelText('Unit')).toBeInTheDocument();
    });

    it('the unit dropdown has default value "pcs"', () => {
      render(<ItemForm onSubmit={vi.fn()} />);

      const unitSelect = screen.getByLabelText('Unit') as HTMLSelectElement;
      expect(unitSelect.value).toBe('pcs');
    });
  });

  describe('Submit flow', () => {
    it('submitting with name="Apples", quantity=2, unit="kg" calls onSubmit("Apples", 2, "kg")', () => {
      const onSubmit = vi.fn();
      render(<ItemForm onSubmit={onSubmit} />);

      fireEvent.change(screen.getByPlaceholderText('Add new item...'), {
        target: { value: 'Apples' },
      });
      fireEvent.change(screen.getByLabelText('Quantity'), {
        target: { value: '2' },
      });
      fireEvent.change(screen.getByLabelText('Unit'), {
        target: { value: 'kg' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add/i }));

      expect(onSubmit).toHaveBeenCalledWith('Apples', 2, 'kg');
    });

    it('unit resets to "pcs" after a successful submit', () => {
      render(<ItemForm onSubmit={vi.fn()} />);

      const unitSelect = screen.getByLabelText('Unit') as HTMLSelectElement;

      // Change unit to "kg"
      fireEvent.change(unitSelect, { target: { value: 'kg' } });
      expect(unitSelect.value).toBe('kg');

      // Fill in name and submit
      fireEvent.change(screen.getByPlaceholderText('Add new item...'), {
        target: { value: 'Test' },
      });
      fireEvent.click(screen.getByRole('button', { name: /add/i }));

      // Unit should be reset to "pcs"
      expect(unitSelect.value).toBe('pcs');
    });

    it('quantity is clamped to minimum 0.1 (entering 0 or negative clamps to 1)', () => {
      const onSubmit = vi.fn();
      render(<ItemForm onSubmit={onSubmit} />);

      fireEvent.change(screen.getByPlaceholderText('Add new item...'), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByLabelText('Quantity'), {
        target: { value: '0' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add/i }));

      expect(onSubmit).toHaveBeenCalledWith('Test', 1, 'pcs');
    });
  });

  describe('Validation', () => {
    it('submitting with empty name does NOT call onSubmit', () => {
      const onSubmit = vi.fn();
      render(<ItemForm onSubmit={onSubmit} />);

      // Click submit without entering a name
      fireEvent.click(screen.getByRole('button', { name: /add/i }));

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('if quantity is empty, defaults to 1', () => {
      const onSubmit = vi.fn();
      render(<ItemForm onSubmit={onSubmit} />);

      fireEvent.change(screen.getByPlaceholderText('Add new item...'), {
        target: { value: 'Test' },
      });

      // Clear the quantity to empty
      const quantityInput = screen.getByLabelText('Quantity');
      fireEvent.change(quantityInput, { target: { value: '' } });

      fireEvent.click(screen.getByRole('button', { name: /add/i }));

      expect(onSubmit).toHaveBeenCalledWith('Test', 1, 'pcs');
    });
  });

  describe('Comma as decimal separator', () => {
    it('accepts comma as decimal separator in quantity', () => {
      const onSubmit = vi.fn();
      render(<ItemForm onSubmit={onSubmit} />);

      fireEvent.change(screen.getByPlaceholderText('Add new item...'), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByLabelText('Quantity'), {
        target: { value: '2,5' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add/i }));
      expect(onSubmit).toHaveBeenCalledWith('Test', 2.5, 'pcs');
    });

    it('blur normalizes comma to period display', () => {
      render(<ItemForm onSubmit={vi.fn()} />);

      const quantityInput = screen.getByLabelText('Quantity');
      fireEvent.change(quantityInput, { target: { value: '3,5' } });
      fireEvent.blur(quantityInput);

      expect(quantityInput).toHaveValue('3.5');
    });
  });
});
