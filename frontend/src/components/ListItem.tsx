import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { type ListItem as ListItemType } from '../types';
import type { TFunction } from 'i18next';
import Swipeable from './Swipeable';
import ConfirmDialog from './ConfirmDialog';

const UNIT_OPTIONS = ["pcs", "kg", "g", "L", "ml", "m", "cm", "tsp", "tbsp", "cups"];

/** Formats a date string as relative time (e.g., "5m ago", "2h ago", "Jan 4") */
function formatRelativeTime(dateString: string, t: TFunction): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return t('item.just_now');
  if (diffMin < 60) return t('item.minutes_ago', { minutes: diffMin });
  if (diffHour < 24) return t('item.hours_ago', { hours: diffHour });
  if (diffDay < 7) return t('item.days_ago', { days: diffDay });
  if (diffWeek < 4) return t('item.weeks_ago', { weeks: diffWeek });

  // Older: show short date like "Jan 4"
  return date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
}

/**
 * Clamps a quantity string to valid range [1, 9999].
 * Invalid input (non-numeric, negative, etc.) returns 1.
 * Values above 9999 are clamped to 9999.
 */
const clampQuantity = (value: string): number => {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0.1) return 1;
  if (parsed > 9999) return 9999;
  return parsed;
};

interface ListItemProps {
  item: ListItemType;
  onToggle: (id: string, isChecked: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, name: string, quantity: number, unit: string) => void;
}

const ListItem: React.FC<ListItemProps> = ({ item, onToggle, onDelete, onEdit }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQuantity, setEditQuantity] = useState(item.quantity);
  const [editUnit, setEditUnit] = useState(item.unit || "pcs");
  const [quantityInputValue, setQuantityInputValue] = useState(String(item.quantity));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleCheckboxChange = (): void => {
    onToggle(item.id, !item.is_checked);
  };

  const handleDelete = (): void => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = useCallback((): void => {
    setShowDeleteConfirm(false);
    onDelete(item.id);
  }, [onDelete, item.id]);

  const cancelDelete = useCallback((): void => {
    setShowDeleteConfirm(false);
  }, []);

  const handleEdit = (): void => {
    setEditName(item.name);
    setEditQuantity(item.quantity);
    setEditUnit(item.unit || "pcs");
    setQuantityInputValue(String(item.quantity));
    setIsEditing(true);
  };

  const handleSave = (): void => {
    if (editName.trim() && editQuantity >= 0.1 && editQuantity <= 9999) {
      onEdit(item.id, editName.trim(), editQuantity, editUnit);
      setIsEditing(false);
    }
  };

  const handleCancel = (): void => {
    setIsEditing(false);
    setEditName(item.name);
    setEditQuantity(item.quantity);
    setEditUnit(item.unit || "pcs");
    setQuantityInputValue(String(item.quantity));
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    }
  };

  const itemContent = (
    <div className={`list-item ${item.is_checked ? 'checked' : ''}`}>
      <label className="list-item-checkbox">
        <input
          type="checkbox"
          checked={item.is_checked}
          onChange={handleCheckboxChange}
        />
        <span className="checkbox-custom"></span>
      </label>

      {!isEditing && (
        <div className="list-item-content">
          <span className={`item-name ${item.is_checked ? 'checked' : ''}`}>
            {item.name}
          </span>
          {item.unit ? (
            <span className="item-quantity">{item.quantity} {item.unit}</span>
          ) : item.quantity > 1 && (
            <span className="item-quantity">x{item.quantity}</span>
          )}
          
          {/* Last updated timestamp - shown as footer note */}
          {(item.updated_at || item.created_at) && (
            <div className="item-timestamp">
              {formatRelativeTime(item.updated_at || item.created_at, t)}
            </div>
          )}
        </div>
      )}

      {/* Edit mode: inline form */}
      {isEditing ? (
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          onKeyDown={handleKeyDown}
        >
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="edit-input"
            autoFocus
            aria-label={t('item.item_name_aria')}
          />
          <input
            type="text"
            inputMode="numeric"
            min="1"
            max="9999"
            value={quantityInputValue}
            onChange={(e) => {
              setQuantityInputValue(e.target.value);
              setEditQuantity(clampQuantity(e.target.value));
            }}
            onBlur={() => {
              const clamped = clampQuantity(quantityInputValue);
              setEditQuantity(clamped);
              setQuantityInputValue(String(clamped));
            }}
            className="edit-quantity-input"
            aria-label={t('item.quantity_aria')}
            aria-valuemin={1}
            aria-valuemax={9999}
            aria-valuenow={editQuantity}
          />
          <select
            value={editUnit}
            onChange={(e) => setEditUnit(e.target.value)}
            className="edit-unit-select"
            aria-label="Unit"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <button
            type="submit"
            className="btn-icon btn-save-item"
            title={t('item.save_changes')}
            aria-label={t('item.save_changes')}
          >
            ✓
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="btn-icon btn-cancel-item"
            title={t('item.cancel_editing')}
            aria-label={t('item.cancel_editing')}
          >
            ✕
          </button>
        </form>
      ) : (
        <>
          <button
            onClick={handleEdit}
            className="btn-icon btn-edit-item"
            title={t('item.edit_item')}
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            className="btn-icon btn-delete-item"
            title={t('item.delete_item')}
          >
            🗑️
          </button>
        </>
      )}
    </div>
  );

  // When editing, render itemContent directly without Swipeable wrapper
  // to prevent accidental swipe-to-delete when tapping save/cancel buttons
  return (
    <>
      {isEditing ? itemContent : (
        <Swipeable onSwipe={handleDelete} onSwipeRight={handleEdit}>
          {itemContent}
        </Swipeable>
      )}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('item.delete_item_title')}
        message={t('item.delete_item_confirm', { itemName: item.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
};

export default ListItem;
