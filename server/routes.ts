import type { Express, Request } from "express";
import { IUser } from "../shared/mongodb-schema";

declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
  }
}
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { Router } from 'express';
import mongoose from 'mongoose';
import { mongoStorage as storage } from './mongodb-storage';
import { 
  insertProductSchema, 
  insertCategorySchema, 
  insertLocationSchema, 
  insertSupplierSchema, 
  insertPurchaseOrderSchema,
} from '../shared/mongodb-schema';
import { IProduct, ISalesHistory, IUser, ICategory, ILocation, ISupplier, IPurchaseOrder } from '../shared/mongodb-schema';
import { ProductWithPopulatedFields } from '../shared/populated-types';
import { 
  AIPrediction, IAIPrediction
} from '../shared/mongodb-schema';

// Extended type for sales with additional frontend-specific fields
type SalesWithDetails = ISalesHistory & {
  productName: string;
  stockLevel: number;
  previousStock?: number;
  newStock?: number;
};

import categoriesRouter from './routes/categories';
import predictionsRouter from './routes/predictions';
import productsRouter from './routes/products';
import * as ss from 'simple-statistics';

// Import the enhanced AI Prediction Service
import { AIPredictionService, DynamicPricingResult } from './services/aiPredictionService';

// Initialize AI service
const aiPredictionService = new AIPredictionService();

// --- Simple in-memory caches for external API enrichment ---
const geocodeCache = new Map<string, any>();
const weatherCache = new Map<string, { ts: number; data: any }>();
const WEATHER_TTL_MS = 1000 * 60 * 30; // 30 minutes

// Cache cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of weatherCache.entries()) {
    if (now - value.ts > WEATHER_TTL_MS) {
      weatherCache.delete(key);
    }
  }
  // Clear geocode cache periodically (keep for 1 hour)
  if (geocodeCache.size > 1000) {
    geocodeCache.clear();
  }
}, 60 * 60 * 1000); // Cleanup every hour

async function geocodeLocationViaOSM(loc: any) {
  const key = JSON.stringify({
    name: loc?.name,
    city: loc?.city,
    state: loc?.state,
    country: loc?.country,
    lat: loc?.coordinates?.lat,
    lng: loc?.coordinates?.lng,
  });
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  let lat = loc?.coordinates?.lat;
  let lng = loc?.coordinates?.lng;
  let displayName = '';

  try {
    if (typeof lat === 'number' && typeof lng === 'number') {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'StockWise/1.0 (demo)' } });
      if (res.ok) {
        const j = await res.json();
        displayName = j?.display_name || '';
        lat = Number(j?.lat) || lat;
        lng = Number(j?.lon) || lng;
      }
    } else {
      const q = [loc?.name, loc?.city, loc?.state, loc?.country].filter(Boolean).join(', ');
      if (q) {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'StockWise/1.0 (demo)' } });
        if (res.ok) {
          const arr = await res.json();
          if (arr?.length) {
            const hit = arr[0];
            lat = Number(hit.lat);
            lng = Number(hit.lon);
            displayName = hit.display_name || q;
          }
        }
      }
    }
  } catch (_) {
    // ignore enrichment errors
  }

  const result = { lat, lng, displayName };
  geocodeCache.set(key, result);
  return result;
}

async function fetchWeatherViaOpenMeteo(lat?: number, lng?: number, days = 30) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${days}`;
  const now = Date.now();
  const cached = weatherCache.get(key);
  if (cached && now - cached.ts < WEATHER_TTL_MS) return cached.data;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&past_days=${Math.min(days, 90)}&daily=temperature_2m_mean,precipitation_sum&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather fetch failed');
    const j = await res.json();
    const temps: number[] = j?.daily?.temperature_2m_mean || [];
    const precs: number[] = j?.daily?.precipitation_sum || [];
    const avgTemp = temps.length ? temps.reduce((a, b) => a + (b || 0), 0) / temps.length : null;
    const totalPrecip = precs.length ? precs.reduce((a, b) => a + (b || 0), 0) : null;
    const data = { avgTemp, totalPrecip };
    weatherCache.set(key, { ts: now, data });
    return data;
  } catch (_) {
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  setupAuth(app);

  // Add auth error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Auth error:', err);
    if (err.name === 'AuthenticationError') {
      return res.status(401).json({ message: err.message });
    }
    next(err);
  });

  // Mount routers
  app.use('/api/categories', categoriesRouter);
  app.use('/api/predictions', predictionsRouter);
  app.use('/api/products', productsRouter);

  // Locations routes
  app.get("/api/locations", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { type } = req.query;
      const query: any = { userId: req.user.id };
      
      // Add type filter if provided
      if (type) {
        query.type = type;
      }
      
      const { Location } = await import('../shared/mongodb-schema');
      const locations = await Location.find(query).sort({ name: 1 });
      
      res.json(locations);
    } catch (error) {
      console.error('Error fetching locations:', error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });
  
  app.post("/api/locations", async (req, res) => {
    try {
      console.log('Received location creation request with body:', req.body);
      
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const payload = insertLocationSchema.parse({ 
        ...req.body, 
        userId: req.user.id 
      });
      
      console.log('Parsed location payload:', payload);
      
      const { Location } = await import('../shared/mongodb-schema');
      console.log('Creating location with data:', payload);
      const location = await new Location(payload).save();
      console.log('Created location:', location);
      
      res.status(201).json(location);
    } catch (error) {
      console.error('Error creating location:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid location data" 
      });
    }
  });

  // Products routes
  app.get("/api/products", async (req, res) => {
    try {
      const { categoryId, locationId, search } = req.query;
      const products = await storage.getProducts({
        userId: req.user?.id,
        categoryId: categoryId as string,
        locationId: locationId as string,
        search: search as string,
      });
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id, req.user?.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Delete product by ID
  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ message: "Product ID is required" });
      }
      const success = await storage.deleteProduct(id, req.user?.id);
      if (!success) {
        return res.status(404).json({ message: "Product not found or not authorized" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const productData = insertProductSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      const product = await storage.createProduct(productData);
      
      // Log inventory movement
      await storage.createInventoryMovement({
        productId: product._id,
        movementType: 'in',
        quantity: product.stockLevel,
        previousStock: 0,
        newStock: product.stockLevel,
        reason: 'Initial stock',
        userId: req.user.id,
      });
      
      res.status(201).json(product);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid product data" 
      });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const updates = insertProductSchema.partial().parse(req.body);
      const existingProduct = await storage.getProduct(req.params.id, req.user.id);
      
      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found or not authorized" });
      }
      
      const product = await storage.updateProduct(req.params.id, req.user.id, updates);
      
      // Log stock level changes
      if (updates.stockLevel !== undefined && updates.stockLevel !== existingProduct.stockLevel) {
        const movementType = updates.stockLevel > existingProduct.stockLevel ? 'in' : 'out';
        const quantity = Math.abs(updates.stockLevel - existingProduct.stockLevel);
        
        await storage.createInventoryMovement({
          productId: req.params.id,
          movementType,
          quantity,
          previousStock: existingProduct.stockLevel,
          newStock: updates.stockLevel,
          reason: 'Manual adjustment',
          userId: req.user.id,
        });
      }
      
      res.json(product);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid product data" 
      });
    }
  });

  // Suppliers routes
  app.get("/api/suppliers", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { Supplier } = await import('../shared/mongodb-schema');
      const suppliers = await Supplier.find({ userId: req.user.id, isActive: true }).sort({ name: 1 });
      res.json(suppliers);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });
  
  app.post("/api/suppliers", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { Supplier } = await import('../shared/mongodb-schema');
      const supplierData = insertSupplierSchema.parse({ ...req.body, userId: req.user.id });
      const supplier = await new Supplier(supplierData).save();
      res.status(201).json(supplier);
    } catch (error) {
      console.error('Error creating supplier:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid supplier data" 
      });
    }
  });

  // Purchase orders routes
  app.get("/api/purchase-orders", async (req, res) => {
    try {
      console.log('Fetching purchase orders...');
      const { PurchaseOrder } = await import('../shared/mongodb-schema');
      const purchaseOrders = await PurchaseOrder.find({}).sort({ createdAt: -1 });
      console.log(`Found ${purchaseOrders.length} purchase orders`);
      res.json(purchaseOrders);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
      res.status(500).json({ 
        message: "Failed to fetch purchase orders",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/purchase-orders", async (req, res) => {
    try {
      console.log('=== CREATE PURCHASE ORDER REQUEST ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      // Validate request body exists
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: "Request body is required" });
      }

      // Log schema validation attempt
      console.log('Attempting schema validation...');
      const poData = insertPurchaseOrderSchema.parse(req.body);
      console.log('✅ Schema validation passed:', JSON.stringify(poData, null, 2));

      // Log storage call
      console.log('Calling storage.createPurchaseOrder...');
      const purchaseOrder = await storage.createPurchaseOrder(poData);
      console.log('✅ Purchase order created successfully:', JSON.stringify(purchaseOrder, null, 2));

      res.status(201).json(purchaseOrder);
    } catch (error) {
      console.error('❌ Failed to create purchase order:');
      
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        
        // Handle Zod validation errors
        if (error.name === 'ZodError') {
          const zodError = error as any;
          console.error('Zod validation errors:', zodError.errors);
          return res.status(400).json({ 
            message: "Invalid purchase order data",
            errors: zodError.errors,
            details: "Schema validation failed"
          });
        }
        
        res.status(400).json({ 
          message: "Invalid purchase order data",
          error: error.message,
          details: "Check the request data format"
        });
      } else {
        console.error('Unknown error type:', error);
        res.status(400).json({ 
          message: "Invalid purchase order data",
          error: String(error)
        });
      }
    }
  });

  app.put("/api/purchase-orders/:id", async (req, res) => {
    try {
      console.log('=== UPDATE PURCHASE ORDER STATUS ===');
      console.log('Order ID:', req.params.id);
      console.log('Request body:', req.body);
      console.log('User ID:', req.user?.id);

      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }

      // Validate status value
      const validStatuses = ['pending', 'approved', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: 'Invalid status value',
          validStatuses 
        });
      }

      console.log(`Updating order ${id} to status: ${status}`);
      const updatedOrder = await storage.updatePurchaseOrderStatus(
        id, 
        status as 'pending' | 'approved' | 'shipped' | 'delivered' | 'cancelled',
        req.user.id
      );

      if (!updatedOrder) {
        console.log(`Order ${id} not found`);
        return res.status(404).json({ message: 'Purchase order not found' });
      }

      console.log('✅ Order status updated successfully:', updatedOrder);
      res.json(updatedOrder);
    } catch (error) {
      console.error('❌ Error updating purchase order status:', error);
      res.status(500).json({ 
        message: 'Failed to update purchase order status',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Low stock and expiring products
  app.get("/api/products/alerts/low-stock", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 10;
      const products = await storage.getLowStockProducts(threshold, req.user.id);
      res.json(products);
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      res.status(500).json({ message: "Failed to fetch low stock products" });
    }
  });

  app.get("/api/products/alerts/expiring", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const days = parseInt(req.query.days as string) || 7;
      const products = await storage.getExpiringProducts(days, req.user.id);
      res.json(products);
    } catch (error) {
      console.error('Error fetching expiring products:', error);
      res.status(500).json({ message: "Failed to fetch expiring products" });
    }
  });

  // Sales routes
  app.post("/api/sales", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { productId, quantity, price, date, fromLocation, toLocation } = req.body;
      
      if (!productId || !quantity || !price || !fromLocation || !toLocation) {
        return res.status(400).json({ 
          message: "Missing required fields: productId, quantity, price, fromLocation, toLocation" 
        });
      }

      // Get the product to check current stock
      const product = await storage.getProduct(productId, req.user.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Check if we have enough stock
      if (product.stockLevel < quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock. Only ${product.stockLevel} available.`,
          availableStock: product.stockLevel
        });
      }

      try {
        // Record the sale with location data
        const sale = await storage.createSale({
          productId,
          userId: req.user.id,
          quantity: Number(quantity),
          price: Number(price),
          date: date || new Date().toISOString(),
          fromLocation,
          toLocation
        });

        // Update product stock
        const newStock = product.stockLevel - quantity;
        await storage.updateProductStock(
          productId,
          newStock,
          req.user.id
        );

        // Create inventory movement
        await storage.createInventoryMovement({
          productId,
          movementType: 'out',
          quantity: Number(quantity),
          previousStock: product.stockLevel,
          newStock,
          reason: 'Sale',
          userId: req.user.id,
          referenceId: sale.id,
          referenceType: 'sale'
        });

        // Check for low stock after update
        if (newStock <= (product.minStockLevel || 5)) {
          await storage.createAlert({
            type: 'low_stock',
            title: 'Low Stock Alert',
            message: `Product ${product.name} is low on stock (${newStock} remaining)`,
            severity: newStock === 0 ? 'critical' : 'high',
            productId: product._id,
          });
        }

        // Return the sale with additional product info and locations
        res.status(201).json({
          ...sale,
          productName: product.name,
          previousStock: product.stockLevel,
          newStock,
          fromLocation,
          toLocation
        });
      } catch (error) {
        console.error('Error in sale processing:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error recording sale:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to record sale",
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      const { productId, days } = req.query;
      console.log('Fetching sales with params:', { productId, days });
      
      // Get sales from storage with proper typing
      const sales = await storage.getSalesHistory(
        productId as string,
        days ? parseInt(days as string) : undefined
      );

      console.log('Raw sales from storage:', JSON.stringify(sales, null, 2));

      // Get all unique product IDs from sales
      const productIds = [...new Set(sales.map((sale: any) => {
        const pid = sale.productId;
        return typeof pid === 'object' && pid !== null 
          ? String(pid._id || '') 
          : String(pid || '');
      }))];

      // Fetch all products in one query
      const products = await Promise.all(
        productIds.map((id: string) => storage.getProductById(id))
      );
      
      // Create a map of productId to product for quick lookup
      const productMap = products.reduce((map: Record<string, any>, product: any) => {
        if (product && product._id) {
          map[product._id.toString()] = product;
        }
        return map;
      }, {});

      // Transform the sales data with product details and location info
      const transformedSales = await Promise.all(
        sales.map(async (sale: any) => {
          const pid = sale.productId;
          const productId = typeof pid === 'object' && pid !== null 
            ? String(pid._id || '') 
            : String(pid || '');
          
          const product = productId ? (productMap[productId] || {}) : {};
          
          // Get current stock level for the product
          let stockLevel = 0;
          try {
            stockLevel = await storage.getProductStockLevel(productId);
          } catch (error) {
            console.error(`Error getting stock level for product ${productId}:`, error);
          }
          
          // Build the transformed sale object with location data
          return {
            ...sale,
            _id: sale._id?.toString(),
            productId,
            productName: product?.name || 'Unknown Product',
            stockLevel,
            date: sale.date ? new Date(sale.date).toISOString() : new Date().toISOString(),
            previousStock: typeof sale.previousStock === 'number' ? sale.previousStock : 0,
            newStock: typeof sale.newStock === 'number' ? sale.newStock : 0,
            fromLocation: sale.fromLocation,
            toLocation: sale.toLocation,
            product: undefined
          } as SalesWithDetails;
        })
      );

      res.json(transformedSales);
    } catch (error) {
      console.error('Error in GET /api/sales:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ 
        message: "Failed to fetch sales history",
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });

  app.get("/api/sales/metrics", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await storage.getSalesMetrics(days);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales metrics" });
    }
  });

  // Inventory movements
  app.get("/api/inventory-movements", async (req, res) => {
    try {
      const { productId } = req.query;
      const movements = await storage.getInventoryMovements(productId as string);
      res.json(movements);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory movements" });
    }
  });

  // ==================== AI PREDICTION & DYNAMIC PRICING ROUTES ====================

  // AI predictions
  app.get("/api/ai/predictions", async (req, res) => {
    try {
      const { productId, type } = req.query;
      
      if (typeof storage.getAIPredictions !== 'function') {
        return res.status(501).json({ message: "AI predictions feature not implemented" });
      }
      
      const predictions = await storage.getAIPredictions(productId as string, type as string);
      res.json(predictions);
    } catch (error) {
      console.error('Error fetching AI predictions:', error);
      res.status(500).json({ message: "Failed to fetch AI predictions" });
    }
  });

  app.post("/api/ai/generate-predictions", async (req, res) => {
    try {
      const products = await storage.getProducts();
      
      if (typeof storage.createAIPrediction !== 'function') {
        return res.status(501).json({ message: "AI prediction generation not implemented" });
      }
      
      const predictions = await generatePredictionsForProducts(products);
      
      res.json(predictions);
    } catch (error) {
      console.error('Error generating AI predictions:', error);
      res.status(500).json({ message: "Failed to generate AI predictions" });
    }
  });

  // Dynamic pricing routes
  app.get("/api/ai/dynamic-pricing/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const { includeSimilar = 'true' } = req.query;

      // Get product and sales data
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const salesHistory = await storage.getSalesHistory(productId, 90);
      
      let similarProducts = [];
      if (includeSimilar === 'true') {
        // Find similar products (same category)
        similarProducts = await storage.getProducts({ 
          categoryId: (product as any).category?._id?.toString() || (product as any).category 
        });
        similarProducts = similarProducts.filter((p: any) => p._id.toString() !== productId);
      }

      const pricingResult = await aiPredictionService.calculateDynamicPricing(
        product as any,
        salesHistory as any,
        similarProducts as any[]
      );

      res.json(pricingResult);
    } catch (error) {
      console.error('Error calculating dynamic pricing:', error);
      res.status(500).json({ 
        message: "Failed to calculate dynamic pricing",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Bulk dynamic pricing for all products
  app.get("/api/ai/dynamic-pricing", async (req, res) => {
    try {
      const { categoryId, limit = '50' } = req.query;
      
      const products = await storage.getProducts({ 
        userId: req.user?.id,
        categoryId: categoryId as string
      });

      const limitNum = parseInt(limit as string);
      const limitedProducts = (products as any[]).slice(0, limitNum);

      const pricingResults: DynamicPricingResult[] = [];

      for (const product of limitedProducts) {
        try {
          const salesHistory = await storage.getSalesHistory(product._id.toString(), 30);
          const pricingResult = await aiPredictionService.calculateDynamicPricing(
            product,
            salesHistory as any
          );
          pricingResults.push(pricingResult);
        } catch (error) {
          console.error(`Failed to calculate pricing for product ${product._id}:`, error);
          // Continue with other products
        }
      }

      res.json(pricingResults);
    } catch (error) {
      console.error('Error in bulk dynamic pricing:', error);
      res.status(500).json({ 
        message: "Failed to calculate bulk dynamic pricing",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Apply dynamic pricing to a product
  app.post("/api/ai/dynamic-pricing/:productId/apply", async (req, res) => {
    try {
      const { productId } = req.params;
      const { newPrice, strategy, confidence } = req.body;

      if (!newPrice || typeof newPrice !== 'number') {
        return res.status(400).json({ message: "Valid newPrice is required" });
      }

      // Get current product
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Update product price
      const updatedProduct = await storage.updateProduct(
        productId,
        req.user?.id || '',
        { price: newPrice }
      );

      // Log the price change
      await storage.createInventoryMovement({
        productId,
        movementType: 'adjustment',
        quantity: 0,
        previousStock: (product as any).stockLevel,
        newStock: (product as any).stockLevel,
        reason: `Dynamic pricing adjustment: ${strategy || 'AI recommended'}`,
        userId: req.user?.id,
        metadata: {
          previousPrice: (product as any).price,
          newPrice,
          strategy,
          confidence
        }
      });

      res.json({
        success: true,
        product: updatedProduct,
        priceChange: {
          from: (product as any).price,
          to: newPrice,
          change: newPrice - (product as any).price,
          percentage: ((newPrice - (product as any).price) / (product as any).price) * 100
        }
      });
    } catch (error) {
      console.error('Error applying dynamic pricing:', error);
      res.status(500).json({ 
        message: "Failed to apply dynamic pricing",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Add cleanup route for old predictions
  app.delete("/api/ai/predictions/cleanup", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      
      if (typeof storage.clearOldPredictions === 'function') {
        const result = await storage.clearOldPredictions(days);
        res.json({ 
          message: `Cleaned up predictions older than ${days} days`,
          deleted: result 
        });
      } else {
        res.status(501).json({ message: "Cleanup feature not implemented" });
      }
    } catch (error) {
      console.error('Error cleaning up predictions:', error);
      res.status(500).json({ message: "Failed to clean up predictions" });
    }
  });

  // Location insights built from recent sales and products
  app.get("/api/ai/location-insights", async (req, res) => {
    try {
      const days = Math.max(1, parseInt((req.query.days as string) || '30'));
      const enrich = (req.query.enrich as string) === '1' || (req.query.enrich as string) === 'true';
      const sort = (req.query.sort as string) || 'potential';

      const [locations, products] = await Promise.all([
        storage.getLocations?.() || [],
        storage.getProducts(),
      ]);

      // Build product index for names
      const productIndex = new Map<string, any>();
      (products as any[]).forEach((p: any) => {
        const productId = p.id || p._id?.toString();
        if (productId) {
          productIndex.set(productId, p);
        }
      });

      type Bucket = {
        location: any;
        totalRevenue: number;
        totalQuantity: number;
        last7Revenue: number;
        prev7Revenue: number;
        productTotals: Record<string, { qty: number; revenue: number; }>;
      };
      const perLocation: Record<string, Bucket> = {};

      for (const loc of locations as any[]) {
        const locId = (loc.id || loc._id) as string;
        perLocation[locId] = { location: loc, totalRevenue: 0, totalQuantity: 0, last7Revenue: 0, prev7Revenue: 0, productTotals: {} };
      }

      // Aggregate by iterating per product to reuse getSalesHistory(productId, days)
      for (const p of products as any[]) {
        const pid = p.id || p._id?.toString();
        if (!pid) continue;
        
        const sales = await storage.getSalesHistory(pid, Math.max(days, 14));
        for (let idx = 0; idx < (sales as any[]).length; idx++) {
          const s: any = (sales as any[])[idx];
          
          // Better location ID resolution
          let locId: string = s.locationId || s.fromLocation || s.toLocation;
          if (!locId && p.location) {
            locId = typeof p.location === 'string' ? p.location : p.location?.id || p.location?._id?.toString();
          }
          
          if (!locId) continue;
          if (!perLocation[locId]) {
            perLocation[locId] = { location: { id: locId, name: 'Unknown' }, totalRevenue: 0, totalQuantity: 0, last7Revenue: 0, prev7Revenue: 0, productTotals: {} } as Bucket;
          }
          const bucket = perLocation[locId];
          const revenue = s.revenue || (s.price || 0) * (s.quantity || 0);
          bucket.totalRevenue += revenue;
          bucket.totalQuantity += s.quantity || 0;
          if ((sales as any[]).length - idx <= 7) bucket.last7Revenue += revenue; else if ((sales as any[]).length - idx <= 14) bucket.prev7Revenue += revenue;
          if (!bucket.productTotals[pid]) bucket.productTotals[pid] = { qty: 0, revenue: 0 };
          bucket.productTotals[pid].qty += s.quantity || 0;
          bucket.productTotals[pid].revenue += revenue;
        }
      }

      let insights = await Promise.all(Object.values(perLocation)
        .filter(x => x.totalQuantity > 0 || x.totalRevenue > 0)
        .map(async x => {
          const topProducts = Object.entries(x.productTotals)
            .sort((a, b) => b[1].revenue - a[1].revenue || b[1].qty - a[1].qty)
            .slice(0, 3)
            .map(([pid]) => (productIndex.get(pid)?.name) || 'Unknown');

          // Growth: last 7 vs previous 7
          const growth = x.prev7Revenue > 0 ? ((x.last7Revenue - x.prev7Revenue) / x.prev7Revenue) : (x.last7Revenue > 0 ? 1 : 0);

          // Confidence: combines sample size and recency stability
          const sampleFactor = Math.min(1, Math.log10(1 + x.totalQuantity) / 2);
          const recencyFactor = Math.max(0, Math.min(1, x.last7Revenue / Math.max(1, x.totalRevenue)));
          const confidence = Math.round(40 + 55 * (0.6 * sampleFactor + 0.4 * recencyFactor));

          // Potential: scaled 30-day revenue to yearly, dampened by low recency
          const monthly = x.totalRevenue * (30 / Math.max(1, days));
          const potentialAnnual = monthly * 12 * Math.max(0.5, 0.8 * recencyFactor + 0.2);

          let geo: any = null;
          let weather: any = null;
          if (enrich) {
            try {
              geo = await geocodeLocationViaOSM(x.location);
              weather = await fetchWeatherViaOpenMeteo(geo?.lat, geo?.lng, days);
            } catch { /* ignore */ }
          }

          return {
            locationId: x.location.id || x.location._id,
            locationName: x.location.name || 'Unknown',
            totalRevenue: Number(x.totalRevenue.toFixed(2)),
            totalUnits: x.totalQuantity,
            topProducts,
            confidence,
            growth,
            potential: `$${Math.round(potentialAnnual).toLocaleString()} annually`,
            opportunity: x.totalQuantity > 0 ? (growth > 0 ? 'Growing demand in this area' : 'Stable/declining demand') : 'Limited recent sales',
            geo,
            weather,
          };
        }));

      // Sorting
      insights.sort((a: any, b: any) => {
        switch (sort) {
          case 'confidence': return (b.confidence || 0) - (a.confidence || 0);
          case 'growth': return (b.growth || 0) - (a.growth || 0);
          case 'revenue': return (b.totalRevenue || 0) - (a.totalRevenue || 0);
          case 'potential':
          default: {
            const pa = typeof a.potential === 'string' ? Number(a.potential.replace(/[^0-9.]/g, '')) : a.potential;
            const pb = typeof b.potential === 'string' ? Number(b.potential.replace(/[^0-9.]/g, '')) : b.potential;
            return (pb || 0) - (pa || 0);
          }
        }
      });

      res.json(insights);
    } catch (err) {
      console.error('Failed to compute location insights', err);
      res.status(500).json({ message: 'Failed to compute location insights' });
    }
  });

  // Alerts routes
  app.get("/api/alerts", async (req, res) => {
    try {
      const isRead = req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined;
      const alerts = await storage.getAlerts(isRead);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // --- Dev-only utilities ---
  app.post('/api/dev/seed-sales', async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: 'Not allowed in production' });
      }

      const days = Math.max(1, parseInt((req.query.days as string) || '30'));
      const maxPerDay = Math.max(1, parseInt((req.query.maxPerDay as string) || '10'));
      const density = Math.max(0, Math.min(1, parseFloat((req.query.density as string) || '0.8')));

      const products = await storage.getProducts();
      let created = 0;

      for (const p of products as any[]) {
        const pid = p.id || p._id?.toString();
        if (!pid) continue;
        
        const price = Number(p.price) || 10;
        const locId = typeof p.location === 'string' ? p.location : (p.location?.id || p.location?._id?.toString());
        for (let i = days - 1; i >= 0; i--) {
          if (Math.random() > density) continue;
          const quantity = Math.floor(Math.random() * maxPerDay) + 1;
          const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          await storage.createSalesRecord({
            productId: pid,
            quantity,
            price,
            revenue: quantity * price,
            locationId: locId,
            date,
          });
          created++;
        }
      }

      res.json({ message: 'Seeded sales history', created, days, products: products.length });
    } catch (err) {
      console.error('Seed sales failed', err);
      res.status(500).json({ message: 'Failed to seed sales' });
    }
  });

  app.put("/api/alerts/:id/read", async (req, res) => {
    try {
      const success = await storage.markAlertAsRead(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Alert not found" });
      }
      res.json({ message: "Alert marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update alert" });
    }
  });

  // Generate alerts for low stock and expiring products
  app.post("/api/alerts/generate", async (req, res) => {
    try {
      const alerts = [];
      
      // Low stock alerts
      const lowStockProducts = await storage.getLowStockProducts();
      for (const product of lowStockProducts) {
        const alert = await storage.createAlert({
          type: 'low_stock',
          title: `Low Stock: ${product.name}`,
          message: `Only ${product.stockLevel} units left`,
          severity: product.stockLevel <= 5 ? 'critical' : 'high',
          productId: product.id || product._id?.toString(),
        });
        alerts.push(alert);
      }
      
      // Expiring products alerts
      const expiringProducts = await storage.getExpiringProducts();
      for (const product of expiringProducts) {
        if (product.expiryDate) {
          const daysUntilExpiry = Math.ceil((new Date(product.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const alert = await storage.createAlert({
            type: 'expiry',
            title: `Expiry Alert: ${product.name}`,
            message: `Expires in ${daysUntilExpiry} days`,
            severity: daysUntilExpiry <= 3 ? 'critical' : 'medium',
            productId: product.id || product._id?.toString(),
          });
          alerts.push(alert);
        }
      }
      
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate alerts" });
    }
  });

  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const products = await storage.getProducts({ userId: req.user?.id });
      const lowStockProducts = await storage.getLowStockProducts(10, req.user?.id);
      const expiringProducts = await storage.getExpiringProducts(7, req.user?.id);
      const salesMetrics = await storage.getSalesMetrics(30);
      
      const metrics = {
        totalProducts: products.length,
        lowStock: lowStockProducts.length,
        expiringSoon: expiringProducts.length,
        totalRevenue: salesMetrics.totalRevenue,
        revenueGrowth: salesMetrics?.revenueGrowth ?? null,
      };
      
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Arduino sensor routes
  app.get("/api/arduino/sensors", async (req, res) => {
    try {
      const sensorId = req.query.sensorId as string;
      const sensorData = await storage.getArduinoData?.(sensorId) || [];
      res.json(sensorData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sensor data" });
    }
  });

  app.post("/api/arduino/sensors", async (req, res) => {
    try {
      const sensorData = req.body;
      const result = await storage.saveArduinoData?.(sensorData) || {};
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: "Invalid sensor data" });
    }
  });

  // Notification routes
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = req.user?.id || 'default-user';
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await storage.getNotifications?.(userId, unreadOnly) || [];
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead?.(req.params.id);
      res.json(notification || {});
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const userId = req.user?.id || 'default-user';
      const result = await storage.markAllNotificationsAsRead?.(userId) || false;
      res.json({ success: result });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  // Search route
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.query as string;
      if (!query || query.length < 3) {
        return res.json([]);
      }

      const [products, categories, locations] = await Promise.all([
        storage.getProducts({ search: query }),
        storage.getCategories?.() || [],
        storage.getLocations?.() || []
      ]);

      const results = [
        ...products.map((p: any) => ({ ...p, type: 'product' })),
        ...categories.filter((c: any) => c.name.toLowerCase().includes(query.toLowerCase())).map((c: any) => ({ ...c, type: 'category' })),
        ...locations.filter((l: any) => l.name.toLowerCase().includes(query.toLowerCase())).map((l: any) => ({ ...l, type: 'location' }))
      ];

      res.json(results.slice(0, 20));
    } catch (error) {
      res.status(500).json({ message: "Search failed" });
    }
  });

  // User profile routes
  app.put("/api/user/profile", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function generatePredictionsForProducts(products: any[]) {
  const allPredictions = [];

  for (const product of products) {
    const productId = product.id || product._id?.toString();
    if (!productId) continue;

    // 1. Demand Forecasting
    const sales = await storage.getSalesHistory(productId, 90);
    const salesData: [number, number][] = sales.map((sale: any, i: number) => [i, sale.quantity]);

    // Current 7-day total
    const last7 = (sales as any[]).slice(-7);
    const current7Total = last7.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);

    let predicted7Total = 0;
    let confidence = 20;
    let demandAlgorithm = 'average_fallback_7d';

    if (salesData.length > 2) {
      const { m: slope, b: intercept } = ss.linearRegression(salesData);
      const line = (x: number) => slope * x + intercept;

      // Predict next 7 daily values and sum them
      const lastX = salesData.length - 1;
      let sumNext7 = 0;
      for (let d = 1; d <= 7; d++) {
        const val = line(lastX + d);
        sumNext7 += Math.max(0, val);
      }
      predicted7Total = Math.round(sumNext7);

      // Calculate R-squared for confidence
      const r2 = ss.rSquared(salesData, line);
      confidence = Math.max(20, Math.min(95, 20 + r2 * 75));
      demandAlgorithm = 'linear_regression_7d_sum';
    } else if (sales.length > 0) {
      // Fallback to simple average daily sales * 7
      const avgDailySales = (sales as any[]).reduce((sum: number, sale: any) => sum + (sale.quantity || 0), 0) / sales.length;
      predicted7Total = Math.round(avgDailySales * 7);
      confidence = 40;
    }

    const demandPrediction = await storage.createAIPrediction({
      productId: productId,
      predictionType: 'demand',
      currentValue: current7Total,
      predictedValue: predicted7Total,
      confidence,
      timeframe: '7d',
      metadata: { algorithm: demandAlgorithm, factors: ['sales_history'] }
    });

    // 2. Price Optimization
    const { m: slope } = salesData.length > 2 ? ss.linearRegression(salesData) : { m: 0 };
    let priceAdjustmentFactor = 1.0;
    if (slope > 0.1) {
      priceAdjustmentFactor = 1.05;
    } else if (slope < -0.1) {
      priceAdjustmentFactor = 0.97;
    }

    const currentPrice = product.price;
    const optimizedPrice = parseFloat((currentPrice * priceAdjustmentFactor).toFixed(2));

    const pricePrediction = await storage.createAIPrediction({
      productId: productId,
      predictionType: 'price',
      currentValue: currentPrice,
      predictedValue: optimizedPrice,
      confidence: Math.round(confidence * 0.8),
      timeframe: '30d',
      metadata: { algorithm: 'trend_based_elasticity', factors: ['demand_trend'] }
    });

    allPredictions.push(demandPrediction, pricePrediction);
  }

  return allPredictions;
}