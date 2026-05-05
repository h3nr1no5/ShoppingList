import React, { useState } from 'react';
import { type ListItem as ListItemType } from '../types';
import Swipeable from './Swipeable';

/** Formats a date string as relative time (e.g., "5m ago", "2h ago", "Jan 4") */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;

  // Older: show short date like "Jan 4"
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface ListItemProps {
  item: ListItemType;
  onToggle: (id: string, isChecked: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, name: string, quantity: number) => void;
}

const ListItem: React.FC<ListItemProps> = ({ item, onToggle, onDelete, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQuantity, setEditQuantity] = useState(item.quantity);

  const handleCheckboxChange = (): void => {
    onToggle(item.id, !item.is_checked);
  };

  const handleDelete = (): void => {
    if (confirm('Are you sure you want to delete this item?')) {
      onDelete(item.id);
    }
  };

  const handleEdit = (): void => {
    setEditName(item.name);
    setEditQuantity(item.quantity);
    setIsEditing(true);
  };

  const handleSave = (): void => {
    if (editName.trim() && editQuantity >= 1 && editQuantity <= 9999) {
      onEdit(item.id, editName.trim(), editQuantity);
      setIsEditing(false);
    }
  };

  const handleCancel = (): void => {
    setIsEditing(false);
    setEditName(item.name);
    setEditQuantity(item.quantity);
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
          {item.quantity > 1 && (
            <span className="item-quantity">x{item.quantity}</span>
          )}
          
          {/* Last updated timestamp - shown as footer note */}
          {(item.updated_at || item.created_at) && (
            <div className="item-timestamp">
              {formatRelativeTime(item.updated_at || item.created_at)}
            </div>
          )}
        </div>
      )}

      {/* Edit mode: inline form */}
      {isEditing ? (
        <div className="edit-form">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="edit-input"
            autoFocus
          />
          <input
            type="number"
            min="1"
            max="9999"
            value={editQuantity}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setEditQuantity(isNaN(val) ? 1 : val);
            }}
            className="edit-quantity-input"
          />
          <button
            onClick={handleSave}
            className="btn-icon btn-save-item"
            title="Save changes"
          >
            ✓
          </button>
          <button
            onClick={handleCancel}
            className="btn-icon btn-cancel-item"
            title="Cancel editing"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={handleEdit}
            className="btn-icon btn-edit-item"
            title="Edit item"
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            className="btn-icon btn-delete-item"
            title="Delete item"
          >
            🗑️
          </button>
        </>
      )}
    </div>
  );

  // When editing, render itemContent directly without Swipeable wrapper
  // to prevent accidental swipe-to-delete when tapping save/cancel buttons
  return isEditing ? itemContent : (
    <Swipeable onSwipe={handleDelete} onSwipeRight={handleEdit}>
      {itemContent}
    </Swipeable>
  );
};

export default ListItem;