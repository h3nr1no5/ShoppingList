import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ItemFormProps {
  onSubmit: (name: string, quantity: number) => void;
  onCancel?: () => void;
}

const clampQuantity = (value: string): number => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) return 1;
  if (parsed > 9999) return 9999;
  return parsed;
};

const ItemForm: React.FC<ItemFormProps> = ({ onSubmit, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [quantityInput, setQuantityInput] = useState("1");

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (name.trim()) {
      const finalQty = clampQuantity(quantityInput);
      onSubmit(name.trim(), finalQty);
      setName('');
      setQuantityInput("1");
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
          onBlur={() => { if (!quantityInput || parseInt(quantityInput, 10) < 1) setQuantityInput("1"); }}
          className="form-input quantity-input"
          aria-label={t('item.quantity_aria')}
        />
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