
export enum Category {
  Clothes = 'ملابس',
  Shoes = 'أحذية',
  Equipment = 'معدات'
}

export interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  size: string;
  lastUpdated: string;
}

export interface DashboardStats {
  totalItems: number;
  lowStockCount: number;
  categories: { name: string; value: number }[];
}
