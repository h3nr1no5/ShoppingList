import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ShoppingList } from '../types';

interface ListFormProps {
  onSubmit: (name: string) => void;
  initialData?: ShoppingList;
  onCancel?: () => void;
}

const ListForm: React.FC<ListFormProps> = ({ onSubmit, initialData, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialData?.name || '');

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label htmlFor="listName" className="form-label">
          {t('list.list_name')}
        </label>
        <input
          type="text"
          id="listName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input"
          placeholder={t('list.enter_list_name')}
          required
        />
      </div>

      <div className="form-actions">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            {t('common.cancel')}
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          {initialData ? t('list.update_list') : t('list.create_list')}
        </button>
      </div>
    </form>
  );
};

export default ListForm;