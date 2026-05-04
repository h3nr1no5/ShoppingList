import React from 'react';
import { type ListItem as ListItemType } from '../types';
import Swipeable from './Swipeable';

interface ListItemProps {
  item: ListItemType;
  onToggle: (id: string, isChecked: boolean) => void;
  onDelete: (id: string) => void;
}

const ListItem: React.FC<ListItemProps> = ({ item, onToggle, onDelete }) => {
  const handleCheckboxChange = (): void => {
    onToggle(item.id, !item.is_checked);
  };

  const handleDelete = (): void => {
    if (confirm('Are you sure you want to delete this item?')) {
      onDelete(item.id);
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

      <div className="list-item-content">
        <span className={`item-name ${item.is_checked ? 'checked' : ''}`}>
          {item.name}
        </span>
        {item.quantity > 1 && (
          <span className="item-quantity">x{item.quantity}</span>
        )}
      </div>

      <button
        onClick={handleDelete}
        className="btn-icon btn-delete-item"
        title="Delete item"
      >
        🗑️
      </button>
    </div>
  );

  return (
    <Swipeable onSwipe={handleDelete}>
      {itemContent}
    </Swipeable>
  );
};

export default ListItem;
