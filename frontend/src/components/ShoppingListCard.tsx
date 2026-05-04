import React from 'react';
import { Link } from 'react-router-dom';
import { type ShoppingList } from '../types';
import Swipeable from './Swipeable';

interface ShoppingListCardProps {
  list: ShoppingList;
  onDelete?: (id: string) => void;
}

const ShoppingListCard: React.FC<ShoppingListCardProps> = ({ list, onDelete }) => {
  const itemCount = list.items?.length || 0;
  const checkedCount = list.items?.filter((item) => item.is_checked).length || 0;

  const handleDelete = (): void => {
    if (onDelete && confirm('Are you sure you want to delete this list?')) {
      onDelete(list.id);
    }
  };

  const cardContent = (
    <Link to={`/lists/${list.id}`} className="card shopping-list-card">
      <div className="card-content">
        <h3 className="card-title">{list.name}</h3>
        <div className="card-meta">
          <span className="item-count">
            {checkedCount}/{itemCount} items
          </span>
        </div>
      </div>
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            handleDelete();
          }}
          className="btn-delete"
          title="Delete list"
        >
          ×
        </button>
      )}
    </Link>
  );

  if (!onDelete) {
    return cardContent;
  }

  return (
    <Swipeable onSwipe={handleDelete} className="swipeable-list-card">
      {cardContent}
    </Swipeable>
  );
};

export default ShoppingListCard;
