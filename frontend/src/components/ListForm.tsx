import React, { useState } from 'react';
import { type ShoppingList } from '../types';

interface ListFormProps {
  onSubmit: (name: string, isPublic: boolean) => void;
  initialData?: ShoppingList;
  onCancel?: () => void;
}

const ListForm: React.FC<ListFormProps> = ({ onSubmit, initialData, onCancel }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [isPublic, setIsPublic] = useState(initialData?.is_public || false);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), isPublic);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label htmlFor="listName" className="form-label">
          List Name
        </label>
        <input
          type="text"
          id="listName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input"
          placeholder="Enter list name"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-checkbox-label">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span>Make this list public</span>
        </label>
        <p className="form-hint">
          Public lists can be shared with others using a link
        </p>
      </div>

      <div className="form-actions">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          {initialData ? 'Update List' : 'Create List'}
        </button>
      </div>
    </form>
  );
};

export default ListForm;