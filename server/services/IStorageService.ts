import { IProduct, ISalesHistory, IAIPrediction } from '../../shared/mongodb-schema';

export interface IStorageService {
  // Existing methods
  getProductById(productId: string): Promise<IProduct | null>;
  
  // New methods for AI predictions
  getSalesHistoryForProduct(productId: string, daysBack?: number): Promise<ISalesHistory[]>;
  savePrediction(prediction: Omit<IAIPrediction, '_id' | 'createdAt'>): Promise<IAIPrediction>;
  getPredictionHistory(productId: string, limit?: number): Promise<IAIPrediction[]>;
  
  // Add other required method signatures as needed
}
