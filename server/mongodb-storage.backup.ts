import mongoose from 'mongoose';
import { 
  User, Category, Location, Product, ArduinoData, Notification, SalesHistory, AIPrediction, InventoryMovement, Alert, Supplier, PurchaseOrder,
  IUser, ICategory, ILocation, IProduct, IArduinoData, INotification, ISalesHistory, IAIPrediction, IInventoryMovement, IAlert, ISupplier, IPurchaseOrder,
  InsertUser, InsertProduct, InsertCategory, InsertLocation, InsertSupplier, InsertPurchaseOrder
} from '../shared/mongodb-schema';
import { ProductWithPopulatedFields, ProductWithStringFields } from '../shared/populated-types';
import bcrypt from 'bcrypt';
import { query } from 'express';

class MongoDBStorage {
  private connected = false;

  constructor() {
    this.connect();
  }

  async connect() {
    if (this.connected) return;
    
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/invenai';
    if (!mongoUrl) {
      throw new Error('MongoDB connection URL is required');
    }
    
    try {
      // Connect without transactions
      await mongoose.connect(mongoUrl, {
        retryWrites: false
      });
      
      this.connected = true;
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw new Error('Failed to connect to MongoDB');
    }
  }

  async disconnect() {
    if (this.connected) {
      await mongoose.disconnect();
      this.connected = false;
    }
  }

  // Create multiple products in bulk
  async createMany(collection: 'products', items: InsertProduct[]): Promise<IProduct[]>;
  async createMany(collection: 'categories', items: InsertCategory[]): Promise<ICategory[]>;
  async createMany(collection: 'locations', items: InsertLocation[]): Promise<ILocation[]>;
  async createMany(collection: 'suppliers', items: InsertSupplier[]): Promise<ISupplier[]>;
  async createMany(collection: string, items: any[]): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Not connected to MongoDB');
    }

    try {
      switch (collection) {
        case 'products': {
          const result = await Product.insertMany(items as InsertProduct[]);
          return result as IProduct[];
        }
        case 'categories': {
          const result = await Category.insertMany(items as InsertCategory[]);
          return result as ICategory[];
        }
        case 'locations': {
          const result = await Location.insertMany(items as InsertLocation[]);
          return result as ILocation[];
        }
        case 'suppliers': {
          const result = await Supplier.insertMany(items as InsertSupplier[]);
          return result as ISupplier[];
        }
        default:
          throw new Error(`Unsupported collection: ${collection}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error creating multiple ${collection}:`, errorMessage);
      throw new Error(`Failed to create multiple ${collection}: ${errorMessage}`);
    }
  }

  // Product methods
  private fallbackStorage?: any; // Add fallbackStorage property

  // Helper function to populate products with category, location, and supplier
  private async populateProducts(products: IProduct[]): Promise<ProductWithPopulatedFields[]> {
    // Get all unique category, location, and supplier IDs
    const categoryIds = new Set<string>();
    const locationIds = new Set<string>();
    const supplierIds = new Set<string>();
    
    // First pass to collect all IDs
    products.forEach(product => {
      const productAny = product as any;
      if (product.category) categoryIds.add(product.category.toString());
      if (product.location) locationIds.add(product.location.toString());
      
      // Check if product has a supplier reference (as ID) or embedded supplier
      if (productAny.supplier?._id) {
        supplierIds.add(productAny.supplier._id.toString());
      } else if (productAny.supplierId) {
        supplierIds.add(productAny.supplierId.toString());
      }
    });
    
    // Fetch all related data in parallel
    const [categories, locations, suppliers] = await Promise.all([
      categoryIds.size > 0 ? Category.find({ _id: { $in: Array.from(categoryIds) } }) : [],
      locationIds.size > 0 ? Location.find({ _id: { $in: Array.from(locationIds) } }) : [],
      supplierIds.size > 0 ? Supplier.find({ _id: { $in: Array.from(supplierIds) } }) : []
    ]);
    
    // Create lookup maps
    const categoryMap = new Map(categories.map(cat => [cat._id.toString(), cat]));
    const locationMap = new Map(locations.map(loc => [loc._id.toString(), loc]));
    const supplierMap = new Map(suppliers.map(sup => [sup._id.toString(), sup]));
    
    // Process each product
    return products.map(product => {
      const productAny = product as any;
      const productObj = product.toObject ? product.toObject() : { ...product } as any;
      
      // Handle category
      if (productObj.category) {
        productObj.category = categoryMap.get(productObj.category.toString()) || null;
      } else {
        productObj.category = null;
      }
      
      // Handle location
      if (productObj.location) {
        productObj.location = locationMap.get(productObj.location.toString()) || null;
      } else {
        productObj.location = null;
      }
      
      // Handle supplier - check both embedded supplier and supplierId
      if (productAny.supplier?._id) {
        const supplierId = productAny.supplier._id.toString();
        productObj.supplier = supplierMap.get(supplierId) || null;
      } else if (productAny.supplierId) {
        const supplierId = productAny.supplierId.toString();
        productObj.supplier = supplierMap.get(supplierId) || null;
      } else {
        productObj.supplier = null;
      }
      
      return productObj as ProductWithPopulatedFields;
    });
  }

  async getProducts(filters: { 
    userId?: string; 
    categoryId?: string; 
    locationId?: string; 
    search?: string 
  } = {}): Promise<ProductWithPopulatedFields[]> {
    if (!this.connected) {
      if (this.fallbackStorage?.getProducts) {
        return this.fallbackStorage.getProducts(filters);
      }
      return [];
    }
    
    const query: any = { isActive: true };
    
    // Always filter by userId if provided
    if (filters?.userId) {
      query.userId = filters.userId;
    }
    
    if (filters?.categoryId) {
      // Check if categoryId is a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(filters.categoryId)) {
        query.category = filters.categoryId;
      } else {
        // If not a valid ObjectId, try to find category by name
        const category = await Category.findOne({ name: filters.categoryId });
        if (category) {
          query.category = category._id;
        } else {
          // If category not found, return empty array
          return [];
        }
      }
    }
    
    if (filters?.locationId) {
      query.location = filters.locationId;
    }
    
    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { sku: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }
    
    // Get products with just the IDs for category and location
    const products = await Product.find(query);
    return this.populateProducts(products);
  }


  async createProduct(productData: InsertProduct & { userId: string }): Promise<ProductWithPopulatedFields> {
    if (!this.connected) {
      if (this.fallbackStorage?.createProduct) {
        const product = await this.fallbackStorage.createProduct(productData);
        return this.populateProducts([product]).then(products => products[0]);
      }
      throw new Error('Not connected to database and no fallback storage available');
    }
    
    // Ensure we don't create duplicate SKUs for the same user
    const existing = await Product.findOne({ 
      userId: productData.userId, 
      sku: productData.sku 
    });
    
    if (existing) {
      throw new Error('A product with this SKU already exists for this user');
    }
    
    const product = new Product(productData);
    await product.save();
    const [populatedProduct] = await this.populateProducts([product]);
    return populatedProduct;
  }

  async updateProduct(id: string, userId: string, updates: Partial<InsertProduct>): Promise<ProductWithPopulatedFields | null> {
    if (!this.connected) {
      if (this.fallbackStorage?.updateProduct) {
        const product = await this.fallbackStorage.updateProduct(id, userId, updates);
        return product ? this.populateProducts([product]).then(products => products[0]) : null;
      }
      return null;
    }
    
    // Ensure the product belongs to the user
    const product = await Product.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true }
    );
    
    if (!product) return null;
    
    const [populatedProduct] = await this.populateProducts([product]);
    return populatedProduct;
  }

  async deleteProduct(id: string, userId?: string): Promise<boolean> {
    if (!this.connected) {
      return this.fallbackStorage?.deleteProduct(id) || false;
    }
    
    const query: any = { _id: id };
    if (userId) {
      query.userId = userId;
    }
    
    const result = await Product.deleteOne(query);
    return result.deletedCount > 0;
  }

  async getLowStockProducts(threshold: number = 10, userId?: string): Promise<IProduct[]> {
    if (!this.connected) {
      return this.fallbackStorage?.getLowStockProducts(threshold) || [];
    }
    
    const query: any = { 
      isActive: true,
      stockLevel: { $lte: threshold }
    };
    
    if (userId) {
      query.userId = userId;
    }
    
    // First get all products without populating
    const products = await Product.find(query).lean();
    
    // Get all unique category and location IDs
    const categoryIds = [...new Set(products.map(p => p.category).filter(Boolean))];
    const locationIds = [...new Set(products.map(p => p.location).filter(Boolean))];
    
    // Fetch all categories and locations in one query each
    const [categories, locations] = await Promise.all([
      categoryIds.length ? Category.find({ _id: { $in: categoryIds } }) : [],
      locationIds.length ? Location.find({ _id: { $in: locationIds } }) : []
    ]);
    
    // Create lookup maps
    const categoryMap = new Map(categories.map(cat => [cat._id.toString(), cat]));
    const locationMap = new Map(locations.map(loc => [loc._id.toString(), loc]));
    
    // Replace IDs with actual documents
    return products.map(product => ({
      ...product,
      category: product.category ? categoryMap.get(product.category.toString()) : null,
      location: product.location ? locationMap.get(product.location.toString()) : null
    }));
  }

  async getExpiringProducts(days: number = 7, userId?: string): Promise<IProduct[]> {
    if (!this.connected) {
      return this.fallbackStorage?.getExpiringProducts(days) || [];
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);
    
    const query: mongoose.FilterQuery<IProduct> = {
      isActive: true,
      expiryDate: { $lte: cutoffDate, $ne: null }
    };
    
    if (userId) {
      query.userId = userId;
    }
    
    // Get products with populated supplier if it exists
    const products = await Product.find(query)
      .populate<{ supplier: ISupplier | null }>('supplier', 'name contactPerson email')
      .lean();
    
    return products.map(product => {
      // Handle the case where category/location might be populated or just ObjectId
      const getStringId = (field: any): string => {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (field._id) return field._id.toString();
        return '';
      };
      
      // Convert to IProduct format
      const result: IProduct = {
        ...product,
        _id: product._id.toString(),
        userId: product.userId?.toString() || '',
        category: getStringId(product.category),
        location: getStringId(product.location) || undefined,
        supplier: product.supplier ? {
          name: product.supplier.name || '',
          contact: product.supplier.contactPerson || '',
          email: product.supplier.email || ''
        } : undefined,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
      
      return result;
    });
  }

  private async hashPassword(password: string) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async comparePasswords(supplied: string, stored: string) {
    return bcrypt.compare(supplied, stored);
  }

  private async initializeData() {
    // Check if data already exists
    const userCount = await User.countDocuments();
    if (userCount > 0) return;

    // Check for existing categories, locations, products to avoid duplicates
    const categoryNames = ['Electronics', 'Food & Beverages', 'Office Supplies', 'Healthcare'];
    const existingCategories = await Category.find({ name: { $in: categoryNames } });
    if (existingCategories.length === categoryNames.length) return;

    console.log('Initializing sample data...');

    // Create categories
    const categories = await Category.insertMany([
      { name: 'Electronics', description: 'Electronic devices and accessories', color: '#3B82F6', icon: 'smartphone' },
      { name: 'Food & Beverages', description: 'Food items and drinks', color: '#10B981', icon: 'apple' },
      { name: 'Office Supplies', description: 'Office and business supplies', color: '#8B5CF6', icon: 'briefcase' },
      { name: 'Healthcare', description: 'Medical and healthcare products', color: '#EF4444', icon: 'heart' },
    ]);

    // Create locations
    const locations = await Location.insertMany([
      { 
        name: 'Main Warehouse', 
        address: '123 Storage Street', 
        city: 'New York', 
        state: 'NY', 
        country: 'USA',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        manager: 'John Smith',
        capacity: 10000
      },
      { 
        name: 'West Coast Distribution', 
        address: '456 Pacific Avenue', 
        city: 'Los Angeles', 
        state: 'CA', 
        country: 'USA',
        coordinates: { lat: 34.0522, lng: -118.2437 },
        manager: 'Sarah Johnson',
        capacity: 8000
      },
      { 
        name: 'Chicago Hub', 
        address: '789 Central Blvd', 
        city: 'Chicago', 
        state: 'IL', 
        country: 'USA',
        coordinates: { lat: 41.8781, lng: -87.6298 },
        manager: 'Mike Davis',
        capacity: 6000
      }
    ]);

    // Create products with Arduino integration
    const products = await Product.insertMany([
      {
        name: 'iPhone 14 Pro',
        sku: 'IP14P-256-SG',
        description: 'Latest iPhone with Pro camera system',
        category: categories[0]._id,
        location: locations[0]._id,
        price: 999.99,
        cost: 750.00,
        stockLevel: 25,
        minStockLevel: 10,
        maxStockLevel: 100,
        barcode: '012345678901',
        qrCode: 'QR_IP14P_256_SG',
        rfidTag: 'RFID_001',
        arduinoSensorId: 'ARD_SENSOR_001',
        weight: 0.206,
        dimensions: { length: 147.5, width: 71.5, height: 7.85 },
        supplier: {
          name: 'Apple Inc.',
          contact: '+1-800-APL-CARE',
          email: 'business@apple.com'
        },
        images: ['/api/images/iphone14pro.jpg']
      },
      {
        name: 'AirPods Pro (2nd Gen)',
        sku: 'APP2-WHITE',
        description: 'Wireless earbuds with active noise cancellation',
        category: categories[0]._id,
        location: locations[0]._id,
        price: 249.99,
        cost: 180.00,
        stockLevel: 8,
        minStockLevel: 15,
        maxStockLevel: 75,
        barcode: '012345678902',
        qrCode: 'QR_APP2_WHITE',
        rfidTag: 'RFID_002',
        arduinoSensorId: 'ARD_SENSOR_002',
        weight: 0.0565,
        dimensions: { length: 4.5, width: 6.1, height: 2.1 },
        supplier: {
          name: 'Apple Inc.',
          contact: '+1-800-APL-CARE',
          email: 'business@apple.com'
        },
        images: ['/api/images/airpods-pro.jpg']
      },
      {
        name: 'MacBook Pro 16"',
        sku: 'MBP16-M3-512',
        description: 'Professional laptop with M3 chip',
        category: categories[0]._id,
        location: locations[1]._id,
        price: 2499.99,
        cost: 1800.00,
        stockLevel: 12,
        minStockLevel: 5,
        maxStockLevel: 30,
        barcode: '012345678903',
        qrCode: 'QR_MBP16_M3_512',
        rfidTag: 'RFID_003',
        arduinoSensorId: 'ARD_SENSOR_003',
        weight: 2.1,
        dimensions: { length: 355.7, width: 248.1, height: 16.8 },
        supplier: {
          name: 'Apple Inc.',
          contact: '+1-800-APL-CARE',
          email: 'business@apple.com'
        },
        images: ['/api/images/macbook-pro.jpg']
      },
      {
        name: 'Protein Bars Mixed Pack',
        sku: 'PB-MIX-24',
        description: 'Assorted protein bars, 24 count',
        category: categories[1]._id,
        location: locations[2]._id,
        price: 39.99,
        cost: 25.00,
        stockLevel: 18,
        minStockLevel: 20,
        maxStockLevel: 200,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        barcode: '012345678904',
        qrCode: 'QR_PB_MIX_24',
        rfidTag: 'RFID_004',
        arduinoSensorId: 'ARD_SENSOR_004',
        weight: 1.44,
        dimensions: { length: 30, width: 20, height: 15 },
        supplier: {
          name: 'NutriCorp',
          contact: '+1-555-NUTRI',
          email: 'orders@nutricorp.com'
        },
        images: ['/api/images/protein-bars.jpg']
      }
    ]);

    // Create sample Arduino sensor data
    await ArduinoData.insertMany([
      {
        sensorId: 'ARD_SENSOR_001',
        productId: products[0]._id,
        sensorType: 'weight',
        value: 0.206,
        unit: 'kg',
        location: locations[0]._id,
        timestamp: new Date()
      },
      {
        sensorId: 'ARD_SENSOR_002',
        productId: products[1]._id,
        sensorType: 'proximity',
        value: 1,
        unit: 'detected',
        location: locations[0]._id,
        timestamp: new Date()
      },
      {
        sensorId: 'ARD_SENSOR_003',
        productId: products[2]._id,
        sensorType: 'temperature',
        value: 22.5,
        unit: 'celsius',
        location: locations[1]._id,
        timestamp: new Date()
      }
    ]);

    // Generate sales history
    for (const product of products) {
      for (let i = 30; i >= 0; i--) {
        const quantity = Math.floor(Math.random() * 10) + 1;
        const price = product.price;
        const revenue = quantity * price;
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        
        await SalesHistory.create({
          productId: product._id,
          quantity,
          price,
          revenue,
          date,
          locationId: product.location
        });
      }
    }

    // Create sample suppliers
    await Supplier.insertMany([
      { name: 'Tech Supplies Inc.', email: 'orders@techsupplies.com' },
      { name: 'Global Electronics', email: 'sales@globalelectronics.com' },
      { name: 'Component Solutions', email: 'support@componentsolutions.com' },
    ]).catch(() => {});

    console.log('Sample data initialized successfully');
  }

  // User methods
  async getUser(id: string): Promise<any> {
    if (!this.connected) {
      return this.fallbackStorage?.getUser(id);
    }
    return await User.findById(id);
  }

  async getUserByUsername(username: string): Promise<any> {
    if (!this.connected) {
      return this.fallbackStorage?.getUserByUsername(username);
    }
    return await User.findOne({ $or: [{ username }, { email: username }] });
  }

  async createUser(userData: InsertUser): Promise<any> {
    if (!this.connected) {
      return this.fallbackStorage?.createUser(userData);
    }
    const hashedPassword = await this.hashPassword(userData.password);
    const user = new User({
      ...userData,
      password: hashedPassword
    });
    return await user.save();
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<any> {
    if (!this.connected) {
      return this.fallbackStorage?.updateUser(id, updates);
    }
    if (updates.password) {
      updates.password = await this.hashPassword(updates.password);
    }
    
    const user = await User.findByIdAndUpdate(id, updates, { new: true });
    return user;
  }


  async getProductById(id: string): Promise<ProductWithPopulatedFields | null> {
    return this.getProduct(id);
  }

  async getProduct(id: string, userId?: string): Promise<ProductWithPopulatedFields | null> {
    if (!this.connected) {
      const product = await this.fallbackStorage?.getProduct?.(id, userId);
      return product ? this.populateProducts([product]).then(products => products[0]) : null;
    }
    
    const query: any = { _id: id };
    if (userId) query.userId = userId;
    
    const product = await Product.findOne(query);
    if (!product) return null;
    
    const [populatedProduct] = await this.populateProducts([product]);
    return populatedProduct;
  }

  async getProductBySku(sku: string, userId?: string): Promise<ProductWithPopulatedFields | null> {
    if (!this.connected) {
      const product = await this.fallbackStorage?.getProductBySku?.(sku, userId);
      return product ? this.populateProducts([product]).then(products => products[0]) : null;
    }
    
    const query: any = { sku };
    if (userId) query.userId = userId;
    
    const product = await Product.findOne(query);
    if (!product) return null;
    
    const [populatedProduct] = await this.populateProducts([product]);
    return populatedProduct;
  }

  async getProductByArduinoSensor(sensorId: string): Promise<IProduct | null> {
    return await Product.findOne({ arduinoSensorId: sensorId }).populate('category location');
  }

  async createProduct(productData: InsertProduct & { userId: string }): Promise<IProduct> {
    // Ensure we don't create duplicate SKUs for the same user
    const existing = await Product.findOne({ userId: productData.userId, sku: productData.sku });
    if (existing) {
      throw new Error('A product with this SKU already exists for this user');
    }
    const product = new Product(productData);
    return await product.save();
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>, userId?: string): Promise<IProduct | null> {
    const query: any = { _id: id };
    if (userId) query.userId = userId;
    return await Product.findOneAndUpdate(query, updates, { new: true });
  }

  async deleteProduct(id: string, userId?: string): Promise<boolean> {
    if (!id || id === 'undefined') return false;
    const query: any = { _id: id };
    if (userId) query.userId = userId;
    const result = await Product.deleteOne(query);
    return result.deletedCount > 0;
  }

  async getLowStockProducts(threshold: number = 10, userId?: string): Promise<IProduct[]> {
    const query: any = {
      isActive: true,
      $expr: { $lte: ['$stockLevel', { $ifNull: ['$minStockLevel', threshold] }] }
    };
    if (userId) query.userId = userId;
    // First get all products without populating
    const products = await Product.find(query).lean();
    
    // Get all unique category and location IDs
    const categoryIds = [...new Set(products.map(p => p.category).filter(Boolean))];
    const locationIds = [...new Set(products.map(p => p.location).filter(Boolean))];
    
    // Fetch all categories and locations in one query each
    const [categories, locations] = await Promise.all([
      categoryIds.length ? Category.find({ _id: { $in: categoryIds } }) : [],
      locationIds.length ? Location.find({ _id: { $in: locationIds } }) : []
    ]);
    
    // Create lookup maps
    const categoryMap = new Map(categories.map(cat => [cat._id.toString(), cat]));
    const locationMap = new Map(locations.map(loc => [loc._id.toString(), loc]));
    
    // Replace IDs with actual documents
    return products.map(product => ({
      ...product,
      category: product.category ? categoryMap.get(product.category.toString()) : null,
      location: product.location ? locationMap.get(product.location.toString()) : null
    }));
  }

  // Inventory Movement methods
  async createInventoryMovement(movementData: Partial<IInventoryMovement>): Promise<IInventoryMovement> {
    const movement = new InventoryMovement(movementData);
    return await movement.save();
  }

  async getInventoryMovements(productId?: string, limit: number = 50): Promise<IInventoryMovement[]> {
    const query = productId ? { productId } : {};
    return await InventoryMovement.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('productId userId');
  }

  async getExpiringProducts(days: number = 7, userId?: string): Promise<IProduct[]> {
    const cutoffDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const query: any = { isActive: true, expiryDate: { $lte: cutoffDate } };
    if (userId) query.userId = userId;
    // First get all products without populating
    const products = await Product.find(query).lean();
    
    // Get all unique category and location IDs
    const categoryIds = [...new Set(products.map(p => p.category).filter(Boolean))];
    const locationIds = [...new Set(products.map(p => p.location).filter(Boolean))];
    
    // Fetch all categories and locations in one query each
    const [categories, locations] = await Promise.all([
      categoryIds.length ? Category.find({ _id: { $in: categoryIds } }) : [],
      locationIds.length ? Location.find({ _id: { $in: locationIds } }) : []
    ]);
    
    // Create lookup maps
    const categoryMap = new Map(categories.map(cat => [cat._id.toString(), cat]));
    const locationMap = new Map(locations.map(loc => [loc._id.toString(), loc]));
    
    // Replace IDs with actual documents
    return products.map(product => ({
      ...product,
      category: product.category ? categoryMap.get(product.category.toString()) : null,
      location: product.location ? locationMap.get(product.location.toString()) : null
    }));
  }

  // Category methods
  async getCategories(): Promise<ICategory[]> {
    return await Category.find({ isActive: true });
  }

  async createCategory(categoryData: InsertCategory): Promise<ICategory> {
    const category = new Category(categoryData);
    return await category.save();
  }

  // Location methods
  async getLocations(userId?: string): Promise<ILocation[]> {
    const query: any = { isActive: true };
    if (userId) query.userId = userId;
    return await Location.find(query);
  }

  // Purchase order methods
  async getPurchaseOrders(userId: string): Promise<IPurchaseOrder[]> {
    if (!this.connected) {
      return this.fallbackStorage?.getPurchaseOrders(userId) || [];
      return this.fallbackStorage?.getPurchaseOrders?.() || [];
    }
    return await PurchaseOrder.find({}).sort({ createdAt: -1 });
  }

  async createPurchaseOrder(data: InsertPurchaseOrder): Promise<IPurchaseOrder> {
    if (!this.connected) {
      return this.fallbackStorage?.createPurchaseOrder?.(data);
    }

    const supplier = await Supplier.findById(data.supplierId);
    if (!supplier) throw new Error('Supplier not found');

    const items: IPurchaseOrder['items'] = [] as any;
    let totalAmount = 0;
    for (const item of data.items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      const unitPrice = product.price;
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;
      items.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      });
    }

    const count = await PurchaseOrder.countDocuments();
    const poNumber = `PO-${(count + 1).toString().padStart(4, '0')}`;

    const po = new PurchaseOrder({
      poNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      items,
      totalAmount,
      expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined,
      notes: data.notes,
      status: 'pending',
    });

    const saved = await po.save();

    // Create a notification (best effort)
    await this.createNotification({
      userId: 'system',
      type: 'system',
      title: `Purchase order created: ${poNumber}`,
      message: `Order to ${supplier.name} for ${items.length} item(s).`,
      severity: 'low',
    }).catch(() => {});

    return saved;
  }

  async updatePurchaseOrderStatus(
    id: string,
    status: 'pending' | 'approved' | 'shipped' | 'delivered' | 'cancelled',
    userId?: string
  ): Promise<IPurchaseOrder | null> {
    try {
      // First try to find by poNumber if the ID looks like a PO number (starts with PO-)
      const query = id.startsWith('PO-') 
        ? { poNumber: id } 
        : { _id: id };

      // First get the current order to check its status
      const order = await PurchaseOrder.findOne(query);
      if (!order) {
        return null;
      }

      // Update the order status
      const updated = await PurchaseOrder.findOneAndUpdate(
        query,
        { status },
        { new: true }
      );

      if (!updated) {
        return null;
      }

      // If status is 'shipped', create in_transit inventory movements
      if (status === 'shipped') {
        for (const item of updated.items) {
          const product = await Product.findById(item.productId);
          if (!product) continue;

          const movementData = {
            productId: product.id,
            movementType: 'in_transit' as const,
            quantity: item.quantity,
            previousStock: product.stockLevel,
            newStock: product.stockLevel, // Stock doesn't change when shipped
            reason: `PO ${updated.poNumber} shipped`,
            referenceId: updated._id.toString(),
            referenceType: 'purchase_order',
            userId: userId || undefined,
          };
          
          await new InventoryMovement(movementData).save();
        }
      }
      // If status is 'delivered', update stock and create in movements
      else if (status === 'delivered') {
        for (const item of updated.items) {
          const product = await Product.findById(item.productId);
          if (!product) continue;

          const previousStock = product.stockLevel;
          const newStock = previousStock + item.quantity;

          // Update product stock
          await Product.findByIdAndUpdate(
            product.id,
            { stockLevel: newStock }
          );

          const movementData = {
            productId: product.id,
            movementType: 'in' as const,
            quantity: item.quantity,
            previousStock,
            newStock,
            reason: `PO ${updated.poNumber} delivered`,
            referenceId: updated._id.toString(),
            referenceType: 'purchase_order',
            userId: userId || undefined,
          };
          
          await new InventoryMovement(movementData).save();
        }
      }

      return updated;
    } catch (error) {
      console.error('Error updating purchase order status:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        orderId: id,
        status,
        userId
      });
      throw error;
    }
  }

  // Arduino methods
  async saveArduinoData(data: {
    sensorId: string;
    productId?: string;
    sensorType: 'weight' | 'proximity' | 'temperature' | 'humidity' | 'rfid';
    value: number;
    unit: string;
    location?: string;
  }): Promise<IArduinoData> {
    const arduinoData = new ArduinoData(data);
    return await arduinoData.save();
  }

  async getArduinoData(sensorId?: string, limit: number = 100): Promise<IArduinoData[]> {
    const query = sensorId ? { sensorId } : {};
    return await ArduinoData.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('productId location');
  }

  async getLatestArduinoReading(sensorId: string): Promise<IArduinoData | null> {
    return await ArduinoData.findOne({ sensorId })
      .sort({ timestamp: -1 })
      .populate('productId location');
  }

  // Notification methods
  async getNotifications(userId: string, unreadOnly: boolean = false): Promise<INotification[]> {
    const query: any = { userId };
    if (unreadOnly) {
      query.isRead = false;
    }
    return await Notification.find(query)
      .sort({ createdAt: -1 })
      .populate('productId');
  }

  async createNotification(notificationData: Partial<INotification>): Promise<INotification> {
    const notification = new Notification(notificationData);
    return await notification.save();
  }

  async markNotificationAsRead(id: string): Promise<INotification | null> {
    return await Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    const result = await Notification.updateMany({ userId }, { isRead: true });
    return result.modifiedCount > 0;
  }

  // Alert methods
  async getAlerts(isRead?: boolean): Promise<IAlert[]> {
    const query: any = {};
    if (isRead !== undefined) {
      query.isRead = isRead;
    }
    return await Alert.find(query)
      .sort({ createdAt: -1 })
      .populate('productId');
  }

  async createAlert(alertData: Partial<IAlert>): Promise<IAlert> {
    const existingAlert = await Alert.findOne({
      productId: alertData.productId,
      type: alertData.type,
      isRead: false,
    });
    if (existingAlert) {
      return existingAlert;
    }
    const alert = new Alert(alertData);
    return await alert.save();
  }

  async markAlertAsRead(id: string): Promise<boolean> {
    const result = await Alert.findByIdAndUpdate(id, { isRead: true });
    return !!result;
  }

  // Sales methods
  async createSale(data: {
    productId: string;
    userId: string;
    quantity: number;
    price: number;
    date?: string | Date;
  }): Promise<ISalesHistory> {
    if (!this.connected) {
      throw new Error('Not connected to MongoDB');
    }

    try {
      const sale = new SalesHistory({
        productId: data.productId,
        quantity: data.quantity,
        price: data.price,
        revenue: data.quantity * data.price,
        date: data.date || new Date(),
        userId: data.userId
      });

      return await sale.save();
    } catch (error) {
      console.error('Error creating sale:', error);
      throw new Error('Failed to create sale');
    }
  }

  async getSalesHistory(productId?: string, days?: number): Promise<ISalesHistory[]> {
    if (!this.connected) {
      throw new Error('Not connected to MongoDB');
    }

    try {
      const query: any = {};
      
      if (productId) {
        query.productId = new mongoose.Types.ObjectId(productId);
      }
      
      if (days) {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        query.date = { $gte: startDate };
      }
      
      // Use aggregation to ensure proper population and transformation
      const sales = await SalesHistory.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            productId: 1,
            productName: { $ifNull: ['$product.name', 'Unknown Product'] },
            quantity: 1,
            price: 1,
            revenue: 1,
            date: 1,
            previousStock: 1,
            newStock: 1,
            stockLevel: { $ifNull: ['$product.stockLevel', 0] },
            product: 1
          }
        },
        { $sort: { date: -1 } }
      ]);

      // Ensure consistent data structure
      return sales.map(sale => ({
        _id: sale._id,
        productId: sale.productId?.toString() || '',
        productName: sale.productName,
        quantity: Number(sale.quantity) || 0,
        price: Number(sale.price) || 0,
        revenue: Number(sale.revenue) || (Number(sale.price) || 0) * (Number(sale.quantity) || 0),
        date: sale.date,
        previousStock: Number(sale.previousStock) || (Number(sale.stockLevel) || 0) + (Number(sale.quantity) || 0),
        newStock: Number(sale.newStock) || Math.max(0, (Number(sale.stockLevel) || 0) - (Number(sale.quantity) || 0)),
        stockLevel: Number(sale.stockLevel) || 0
      }));
    } catch (error) {
      console.error('Error in getSalesHistory:', error);
      throw error;
    }
  }

  async createInventoryMovement(data: {
    productId: string;
    movementType: 'in' | 'out' | 'adjustment' | 'in_transit';
    quantity: number;
    previousStock: number;
    newStock: number;
    reason: string;
    userId?: string;
    referenceId?: string;
    referenceType?: string;
  }): Promise<IInventoryMovement> {
    if (!this.connected) {
      throw new Error('Not connected to MongoDB');
    }

    try {
      const movement = new InventoryMovement({
        ...data,
        timestamp: new Date()
      });
      return await movement.save();
    } catch (error) {
      console.error('Error creating inventory movement:', error);
      throw new Error('Failed to create inventory movement');
    }
  }

  async getProductStockLevel(productId: string): Promise<number> {
    if (!this.connected) {
      throw new Error('Not connected to MongoDB');
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    return product.stockLevel || 0;
  }

  async updateProductStock(
    productId: string, 
    newStock: number, 
    userId?: string
  ): Promise<IProduct> {
    if (!this.connected) {
      throw new Error('Not connected to MongoDB');
    }

    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const previousStock = product.stockLevel;
      product.stockLevel = newStock;
      
      const updatedProduct = await product.save();
      
      // Create inventory movement record
      if (previousStock !== newStock) {
        await this.createInventoryMovement({
          productId,
          movementType: newStock > previousStock ? 'in' : 'out',
          quantity: Math.abs(newStock - previousStock),
          previousStock,
          newStock,
          reason: 'Stock adjustment',
          userId,
          referenceType: 'stock_adjustment'
        });
      }
      
      return updatedProduct;
    } catch (error) {
      console.error('Error updating product stock:', error);
      throw new Error('Failed to update product stock');
    }
  }

  // Deprecated - use createSale instead
  async createSalesRecord(data: {
    productId: string;
    quantity: number;
    price: number;
    revenue: number;
    locationId?: string;
    customerId?: string;
    salesPerson?: string;
    date?: Date;
  }): Promise<ISalesHistory> {
    const salesRecord = new SalesHistory(data);
    return await salesRecord.save();
  }

  async getSalesMetrics(days?: number): Promise<any> {
    const matchStage: any = {};
    
    if (days) {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      matchStage.date = { $gte: startDate };
    }
    
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$revenue' },
          totalQuantity: { $sum: '$quantity' },
          totalOrders: { $sum: 1 }
        }
      }
    ];
    
    const result = await SalesHistory.aggregate(pipeline);
    const metrics = result[0] || { totalRevenue: 0, totalQuantity: 0, totalOrders: 0 };
    
    return {
  }
  return await Alert.find(query)
    .sort({ createdAt: -1 })
    .populate('productId');
}

async createAlert(alertData: Partial<IAlert>): Promise<IAlert> {
  const existingAlert = await Alert.findOne({
    productId: alertData.productId,
    type: alertData.type,
    isRead: false,
  });
  if (existingAlert) {
    return existingAlert;
      query.predictionType = type;
    }
    return await AIPrediction.find(query)
      .sort({ createdAt: -1 })
      .populate('productId');
  }

  async createAIPrediction(predictionData: Partial<IAIPrediction>): Promise<IAIPrediction> {
    const data: Partial<IAIPrediction> = {
      ...predictionData,
      currentValue: typeof predictionData.currentValue === 'string' ? parseFloat(predictionData.currentValue) : predictionData.currentValue,
      predictedValue: typeof predictionData.predictedValue === 'string' ? parseFloat(predictionData.predictedValue) : predictionData.predictedValue,
      confidence: typeof predictionData.confidence === 'string' ? parseFloat(predictionData.confidence) : predictionData.confidence,
    };
    const prediction = new AIPrediction(data);
    return await prediction.save();
  }

  async clearOldPredictions(days: number = 7): Promise<boolean> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await AIPrediction.deleteMany({ createdAt: { $lt: cutoffDate } });
    return result.deletedCount > 0;
  }
}

// Export the class for type safety and testing
export { MongoDBStorage };

// Export a singleton instance for application use
export const mongoStorage = new MongoDBStorage();