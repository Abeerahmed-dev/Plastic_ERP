export interface UOM {
  id: string;
  name: string;
  abbreviation: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUOMData {
  name: string;
  abbreviation: string;
}

export type UpdateUOMData = Partial<CreateUOMData> & {
  is_active?: boolean;
};
