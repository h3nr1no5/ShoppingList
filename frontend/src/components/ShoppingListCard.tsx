import React from 'react';
import { Link } from 'react-router-dom';
import { type ShoppingList } from '../types';

interface ShoppingListCardProps {
  list: ShoppingList;
  onDelete?: (id: string) => void;
}

const ShoppingListCard: React.FC<ShoppingListCardProps> = ({ list, onDelete }) => {
  const itemCount = list.items?.length || 0;
  const checkedCount = list.items?.filter((item) => item.is_checked).length || 0;

  const handleDelete = (e: React.MouseEvent): void => {
    e.preventDefault();
    if (onDelete && confirm('Are you sure you want to delete this list?')) {
      onDelete(list.id);
    }
  };

  return (
    <Link to={`/lists/${list.id}`} className="card shopping-list-card">
      <div className="card-content">
        <h3 className="card-title">{list.name}</h3>
        <div className="card-meta">
          <span className="item-count">
            {checkedCount}/{itemCount} items
          </span>
          {list.is_public && (
            <span className="badge badge-public">Public</span>
          )}
        </div>
      </div>
      {onDelete && (
        <button
          onClick={handleDelete}
          className="btn-delete"
          title="Delete list"
        >
          ×
        </button>
      )}
    </Link>
  );
};

export default ShoppingListCard;