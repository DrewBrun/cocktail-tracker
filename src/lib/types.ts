export type Drink = {
  id?: number;
  title: string;
  description?: string;
  recipe?: string;
  comments?: string;
  selected?: boolean;
  categoryId?: number | null;
};
