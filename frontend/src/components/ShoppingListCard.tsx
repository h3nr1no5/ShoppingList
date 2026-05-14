import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type ShoppingList } from '../types';
import Swipeable from './Swipeable';
import ConfirmDialog from './ConfirmDialog';

interface ShoppingListCardProps {
  list: ShoppingList;
  onDelete?: (id: string) => void;
  disabled?: boolean;
}

const ShoppingListCard: React.FC<ShoppingListCardProps> = ({ list, onDelete, disabled = false }) => {
  const { t } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const itemCount = list.items?.length || 0;
  const checkedCount = list.items?.filter((item) => item.is_checked).length || 0;

  const handleDelete = (): void => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = useCallback((): void => {
    setShowDeleteConfirm(false);
    if (onDelete) {
      onDelete(list.id);
    }
  }, [onDelete, list.id]);

  const cancelDelete = useCallback((): void => {
    setShowDeleteConfirm(false);
  }, []);

  const cardContent = (
    <Link to={`/lists/${list.id}`} className="card shopping-list-card">
      <div className="card-content">
        <h3 className="card-title">{list.name}</h3>
        <div className="card-meta">
          <span className="item-count">
            {t('list.items_count', { checkedCount, itemCount })}
          </span>
        </div>
      </div>
      {onDelete && !disabled && (
        <button
          onClick={(e) => {
            e.preventDefault();
            handleDelete();
          }}
          className="btn-delete"
          title={t('list.delete_list_title')}
        >
          ×
        </button>
      )}
    </Link>
  );

  if (!onDelete || disabled) {
    return cardContent;
  }

  return (
    <>
      <Swipeable onSwipe={handleDelete} className="swipeable-list-card">
        {cardContent}
      </Swipeable>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('list.delete_list_title')}
        message={t('list.delete_list_confirm', { listName: list.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
};

export default ShoppingListCard;