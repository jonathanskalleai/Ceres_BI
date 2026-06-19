export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: 'admin' | 'normal';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppModule {
  id: string;
  label: string;
  group_id: string;
  group_label: string;
  sort_order: number;
  icon_name: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  module_id: string;
  granted_by: string | null;
  created_at: string;
}
