export interface User {
  id: string;
  email: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  owner_id: string | null;
  share_code: string | null;
  items?: ListItem[] | null;
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  is_checked: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string | null; // NEW: Last updated timestamp (falls back to created_at)
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  invite_code?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
