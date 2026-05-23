import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const UNIT_OPTIONS = ["pcs", "kg", "g", "L", "ml", "m", "cm", "tsp", "tbsp", "cups"];

interface ItemFormProps {
  onSubmit: (name: string, quantity: number, unit: string) => void;
  onCancel?: () => void;
}

const clampQuantity = (value: string): number => {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0.1) return 1;
  if (parsed > 9999) return 9999;
  return parsed;
};

const ItemForm: React.FC<ItemFormProps> = ({ onSubmit, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [quantityInput, setQuantityInput] = useState("1");
  const [unit, setUnit] = useState("pcs");

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (name.trim()) {
      const finalQty = clampQuantity(quantityInput);
      onSubmit(name.trim(), finalQty, unit);
      setName('');
      setQuantityInput("1");
      setUnit("pcs");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="item-form">
      <div className="item-form-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input"
          placeholder={t('item.add_new_item')}
          autoFocus
        />
        <input
          type="text"
          inputMode="numeric"
          min="1"
          max="9999"
          value={quantityInput}
          onChange={(e) => setQuantityInput(e.target.value)}
          onBlur={() => { if (!quantityInput || parseFloat(quantityInput) < 0.1) setQuantityInput("1"); }}
          className="form-input quantity-input"
          aria-label={t('item.quantity_aria')}
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="form-input unit-select"
          aria-label="Unit"
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary">
          {t('item.add')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
    </form>
  );
};

export default ItemForm;
