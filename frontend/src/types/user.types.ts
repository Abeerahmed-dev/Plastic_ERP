export interface User {
  id: string;
  name: string;
  email: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password?: string; // Optional because we might auto-generate it or require it on creation
  role_id: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role_id?: string;
  is_active?: boolean;
}

export interface Role {
  id: string;
  name: string;
}
