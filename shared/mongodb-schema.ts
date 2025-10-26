import mongoose, { Schema, Document } from 'mongoose';
import { z } from 'zod';

// User Schema
export interface IUser extends Document {
  _id: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'employee';
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phone?: string;
  preferences: {
    notifications: boolean;
    theme: 'light' | 'dark';
    language: string;
  };
  lastLogin?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'employee'], default: 'manager' },
  firstName: String,
  lastName: String,
  avatar: String,
  phone: String,
  preferences: {
    notifications: { type: Boolean, default: true },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    language: { type: String, default: 'en' }
  },
  lastLogin: Date,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', userSchema);

// Category Schema
export interface ICategory extends Document {
  _id: string;
  name: string;
  userId: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>({
  userId: { type: String, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  description: String,
  color: String,
  icon: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Category = mongoose.model<ICategory>('Category', categorySchema);

// Location Schema
export type LocationType = 'warehouse' | 'shop';

export interface ILocation extends Document {
  _id: string;
  name: string;
  userId: string;
  type: LocationType;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  manager?: string;
  capacity?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<ILocation>({
  userId: { type: String, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['warehouse', 'shop'],
    default: 'warehouse',
    required: true,
    index: true
  },
  address: String,
  city: String,
  state: String,
  country: String,
  coordinates: {
    lat: Number,
    lng: Number
  },
  manager: String,
  capacity: Number,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Location = mongoose.model<ILocation>('Location', locationSchema);

// Product Schema with Arduino Integration
export interface IProduct extends Document {
  _id: string;
  userId: string; // Add userId to associate product with user
  name: string;
  sku: string;
  description?: string;
  category: string;
  location?: string;
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
  arduinoSensorId?: string; // Arduino sensor integration
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

const productSchema = new Schema<IProduct>({
  userId: { type: String, ref: 'User', required: true, index: true }, // Add userId field
  name: { type: String, required: true },
  sku: { 
    type: String, 
    required: true,
    index: true 
  },
  description: String,
  category: { type: String, ref: 'Category', required: true },
  location: { type: String, ref: 'Location' },
  price: { type: Number, required: true },
  cost: Number,
  stockLevel: { type: Number, required: true, default: 0 },
  minStockLevel: { type: Number, default: 10 },
  maxStockLevel: { type: Number, default: 1000 },
  expiryDate: Date,
  imageUrl: String,
  images: [String],
  barcode: String,
  qrCode: String,
  rfidTag: String,
  arduinoSensorId: String, // Arduino integration
  weight: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  supplier: {
    name: String,
    contact: String,
    email: String
  },
  isActive: { type: Boolean, default: true }
}, { 
  timestamps: true 
});

// Create compound index for userId and sku to ensure SKU uniqueness per user
productSchema.index({ userId: 1, sku: 1 }, { unique: true });

export const Product = mongoose.model<IProduct>('Product', productSchema);

// Arduino Sensor Data Schema
export interface IArduinoData extends Document {
  _id: string;
  sensorId: string;
  productId?: string;
  sensorType: 'weight' | 'proximity' | 'temperature' | 'humidity' | 'rfid';
  value: number;
  unit: string;
  timestamp: Date;
  location?: string;
  isValid: boolean;
}

const arduinoDataSchema = new Schema<IArduinoData>({
  sensorId: { type: String, required: true },
  productId: { type: String, ref: 'Product' },
  sensorType: { type: String, enum: ['weight', 'proximity', 'temperature', 'humidity', 'rfid'], required: true },
  value: { type: Number, required: true },
  unit: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  location: { type: String, ref: 'Location' },
  isValid: { type: Boolean, default: true }
}, { timestamps: true });

export const ArduinoData = mongoose.model<IArduinoData>('ArduinoData', arduinoDataSchema);

// Notification Schema
export interface INotification extends Document {
  _id: string;
  userId: string;
  type: 'low_stock' | 'expiry' | 'price_change' | 'arduino_alert' | 'system';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  productId?: string;
  isRead: boolean;
  actionUrl?: string;
  metadata?: any;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>({
  userId: { type: String, ref: 'User', required: true },
  type: { type: String, enum: ['low_stock', 'expiry', 'price_change', 'arduino_alert', 'system'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  productId: { type: String, ref: 'Product' },
  isRead: { type: Boolean, default: false },
  actionUrl: String,
  metadata: Schema.Types.Mixed
}, { timestamps: true });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);

// Sales History Schema
export interface ISalesHistory extends Document {
  _id: string;
  productId: string;
  quantity: number;
  price: number;
  revenue: number;
  date: Date;
  locationId?: string;
  fromLocation?: string;  // Add from location
  toLocation?: string;    // Add to location
  customerId?: string;
  salesPerson?: string;
}

const salesHistorySchema = new Schema<ISalesHistory>({
  productId: { type: String, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  revenue: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  locationId: { type: String, ref: 'Location' },
  fromLocation: { type: String, ref: 'Location' }, // Add from location
  toLocation: { type: String, ref: 'Location' },   // Add to location
  customerId: String,
  salesPerson: String
}, { timestamps: true });

export const SalesHistory = mongoose.model<ISalesHistory>('SalesHistory', salesHistorySchema);

// AI Prediction Schema
export interface IAIPrediction extends Document {
  _id: string;
  productId: string;
  predictionType: 'demand' | 'price' | 'expiry';
  currentValue: number;
  predictedValue: number;
  confidence: number;
  timeframe: string;
  metadata?: any;
  createdAt: Date;
}

const aiPredictionSchema = new Schema<IAIPrediction>({
  productId: { type: String, ref: 'Product', required: true },
  predictionType: { type: String, enum: ['demand', 'price', 'expiry'], required: true },
  currentValue: Number,
  predictedValue: Number,
  confidence: Number,
  timeframe: String,
  metadata: Schema.Types.Mixed
}, { timestamps: true });

export const AIPrediction = mongoose.model<IAIPrediction>('AIPrediction', aiPredictionSchema);

// Inventory Movement Schema
export interface IInventoryMovement extends Document {
  _id: string;
  productId: string;
  movementType: 'in' | 'out' | 'adjustment' | 'in_transit';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  userId?: string;
  referenceId?: string;       // ID of the related document (e.g., purchase order ID)
  referenceType?: string;     // Type of the reference (e.g., 'purchase_order', 'sales_order')
  timestamp: Date;
}

const inventoryMovementSchema = new Schema<IInventoryMovement>({
  productId: { type: String, ref: 'Product', required: true },
  movementType: { type: String, enum: ['in', 'out', 'adjustment', 'in_transit'], required: true },
  quantity: { type: Number, required: true },
  previousStock: { type: Number, required: true },
  newStock: { type: Number, required: true },
  reason: String,
  userId: { type: String, ref: 'User' },
  referenceId: { type: String, index: true },  // For faster lookups
  referenceType: { type: String, index: true }, // For faster lookups
  timestamp: { type: Date, default: Date.now, index: true }
});

export const InventoryMovement = mongoose.model<IInventoryMovement>('InventoryMovement', inventoryMovementSchema);

// Alert Schema
export interface IAlert extends Document {
  _id: string;
  type: 'low_stock' | 'expiry' | 'system';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  productId?: string;
  isRead: boolean;
  createdAt: Date;
}

const alertSchema = new Schema<IAlert>({
  type: { type: String, enum: ['low_stock', 'expiry', 'system'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  productId: { type: String, ref: 'Product' },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

export const Alert = mongoose.model<IAlert>('Alert', alertSchema);

// Supplier Schema
export interface ISupplier extends Document {
  _id: string;
  name: string;
  userId: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<ISupplier>(
  {
    userId: { type: String, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    contactPerson: String,
    email: { type: String, required: true },
    phone: String,
    address: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Supplier = mongoose.model<ISupplier>('Supplier', supplierSchema);

// Purchase Order Schema
export interface IPurchaseOrderItem {
  productId: string;
  productName: string; // denormalized for easier display
  quantity: number;
  unitPrice: number; // price at time of order
  totalPrice: number;
}

export interface IPurchaseOrder extends Document {
  _id: string;
  poNumber: string; // Purchase Order number
  supplierId: string;
  supplierName: string; // denormalized
  items: IPurchaseOrderItem[];
  totalAmount: number;
  status: 'pending' | 'approved' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: Date;
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
  {
    productId: { type: String, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    poNumber: { type: String, required: true, unique: true },
    supplierId: { type: String, ref: 'Supplier', required: true },
    supplierName: { type: String, required: true },
    items: [purchaseOrderItemSchema],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    orderDate: { type: Date, default: Date.now },
    expectedDeliveryDate: Date,
    actualDeliveryDate: Date,
    notes: String,
  },
  { timestamps: true }
);

export const PurchaseOrder = mongoose.model<IPurchaseOrder>('PurchaseOrder', purchaseOrderSchema);

// Validation Schemas
export const insertUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'manager', 'employee']).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional()
});

export const insertProductSchema = z.object({
  userId: z.string().min(1, { message: "User ID is required" }),
  name: z.string().min(1),
  sku: z.string().min(1),
  description: z.string().optional(),
  category: z.string(),
  location: z.string().optional(),
  price: z.number().positive(),
  cost: z.number().optional(),
  stockLevel: z.number().min(0).optional(),
  minStockLevel: z.number().min(0).optional(),
  maxStockLevel: z.number().min(0).optional(),
  expiryDate: z.string().optional(),
  barcode: z.string().optional(),
  qrCode: z.string().optional(),
  rfidTag: z.string().optional(),
  arduinoSensorId: z.string().optional(),
  weight: z.number().optional(),
  supplier: z.object({
    name: z.string(),
    contact: z.string(),
    email: z.string().email()
  }).optional()
});

export const insertCategorySchema = z.object({
  userId: z.string().min(1, { message: "User ID is required" }),
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional()
});

export const insertLocationSchema = z.object({
  userId: z.string().min(1, { message: "User ID is required" }),
  name: z.string().min(1, { message: "Location name is required" }),
  type: z.enum(['warehouse', 'shop'], {
    required_error: "Location type is required",
    invalid_type_error: "Location type must be either 'warehouse' or 'shop'"
  }),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  coordinates:
    z.object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  manager: z.string().optional(),
  capacity: z.number().optional(),
});

export const insertSupplierSchema = z.object({
  userId: z.string().min(1, { message: "User ID is required" }),
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const insertPurchaseOrderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1),
});

export const insertPurchaseOrderSchema = z.object({
  supplierId: z.string(),
  items: z.array(insertPurchaseOrderItemSchema).min(1),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;