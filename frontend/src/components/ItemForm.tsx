import React, { useState } from 'react';

interface ItemFormProps {
  onSubmit: (name: string, quantity: number) => void;
  onCancel?: () => void;
}

const ItemForm: React.FC<ItemFormProps> = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), quantity);
      setName('');
      setQuantity(1);
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
          placeholder="Add new item..."
          autoFocus
        />
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="form-input quantity-input"
        />
        <button type="submit" className="btn btn-primary">
          Add
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default ItemForm;