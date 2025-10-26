import { ICategory, ILocation } from './mongodb-schema';

export interface IPopulatedProduct {
  _id: string;
  userId: string;
  name: string;
  sku: string;
  description?: string;
  category: ICategory | string;
  location?: ILocation | string | null;
  price: number;
  cost?: number;
  stockLevel: number;
  minStockLevel: number;
  maxStockLevel: number;
  expiryDate?: Date;
  imageUrl?: string;
  images: string[];
  barcode?: string;
  qrCode?: string;
  rfidTag?: string;
  arduinoSensorId?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  supplier?: {
    name: string;
    contact: string;
    email: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductWithPopulatedFields = Omit<IPopulatedProduct, 'category' | 'location'> & {
  category: ICategory;
  location: ILocation | null;
};

export type ProductWithStringFields = Omit<IPopulatedProduct, 'category' | 'location'> & {
  category: string;
  location: string | null;
};
