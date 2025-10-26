import { Router } from 'express';
import { mongoStorage as storage } from '../mongodb-storage';
import { InsertProduct, IUser } from '../../shared/mongodb-schema';
import { z } from 'zod';

declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
  }
}

const router = Router();

// Define the product input type from CSV
const productInputSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().optional(),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  location: z.string().optional(),
  price: z.union([z.number(), z.string()]).transform(val => Number(val)),
  cost: z.union([z.number(), z.string()]).optional().transform(val => val === undefined ? undefined : Number(val)),
  stockLevel: z.union([z.number(), z.string()]).optional().default(0).transform(val => Number(val)),
  minStockLevel: z.union([z.number(), z.string()]).optional().default(5).transform(val => Number(val)),
  maxStockLevel: z.union([z.number(), z.string()]).optional().transform(val => val === undefined ? undefined : Number(val)),
  barcode: z.string().optional(),
  qrCode: z.string().optional(),
  rfidTag: z.string().optional(),
  arduinoSensorId: z.string().optional(),
  weight: z.union([z.number(), z.string()]).optional().transform(val => val === undefined ? undefined : Number(val)),
  supplierName: z.string().optional(),
  supplierContact: z.string().optional(),
  supplierEmail: z.string().email().optional(),
  expiryDate: z.union([z.string(), z.date()]).optional()
});

type ProductInput = z.infer<typeof productInputSchema>;

// Import products from CSV
router.post('/import', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    
    const { products } = req.body as { products: ProductInput[] };

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'No products provided for import' });
    }
    
    console.log(`Received ${products.length} products for import`);

    // Prepare products with required fields
    const productsToImport: InsertProduct[] = [];
    const now = new Date();

    // Process and validate each product
    const validProducts = [];
    for (const input of products) {
      // Clean up string values by removing surrounding quotes
      const cleanedInput: Record<string, any> = { ...input };
      for (const [key, value] of Object.entries(cleanedInput)) {
        if (typeof value === 'string') {
          // Remove surrounding quotes if they exist
          cleanedInput[key] = value.replace(/^"|"$/g, '');
        }
      }
      
      console.log('Validating product input:', JSON.stringify(cleanedInput, null, 2));
      const validationResult = productInputSchema.safeParse(cleanedInput);
      if (!validationResult.success) {
        console.warn('Invalid product input:', { input: cleanedInput, error: validationResult.error.format() });
        continue;
      }

      const product = validationResult.data;
      
      // Create the base product with required fields
      const productData: Omit<InsertProduct, 'userId'> = {
        name: product.name,
        sku: product.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        description: product.description,
        category: product.category,
        price: product.price,
        stockLevel: product.stockLevel,
        minStockLevel: product.minStockLevel,
      };

      // Add optional fields if they exist
      if (product.cost !== undefined) productData.cost = product.cost;
      if (product.maxStockLevel !== undefined) productData.maxStockLevel = product.maxStockLevel;
      if (product.location) productData.location = product.location;
      if (product.barcode) productData.barcode = product.barcode;
      if (product.qrCode) productData.qrCode = product.qrCode;
      if (product.rfidTag) productData.rfidTag = product.rfidTag;
      if (product.arduinoSensorId) productData.arduinoSensorId = product.arduinoSensorId;
      if (product.weight !== undefined) productData.weight = product.weight;
      
      // Handle supplier if any supplier information is provided
      if (product.supplierName || product.supplierContact || product.supplierEmail) {
        productData.supplier = {
          name: product.supplierName || 'Unknown',
          contact: product.supplierContact || '',
          email: product.supplierEmail || ''
        };
      }
      
      // Handle expiry date
      if (product.expiryDate) {
        const expiryDate = new Date(product.expiryDate);
        if (!isNaN(expiryDate.getTime())) {
          productData.expiryDate = expiryDate.toISOString();
        }
      }

      // Add the userId and timestamps
      const finalProduct: InsertProduct = {
        ...productData,
        userId: req.user.id,
      };

      productsToImport.push(finalProduct);
    }

    // Insert products into database
    const result = await storage.createMany('products', productsToImport);
    
    return res.status(201).json({
      message: 'Products imported successfully',
      count: result.length,
      products: result
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error importing products:', error);
    return res.status(500).json({ 
      message: 'Failed to import products',
      error: errorMessage 
    });
  }
});

// Get all products
router.get('/', async (req, res) => {
  try {
    // Prevent caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const products = await storage.getProducts({ userId: req.user.id });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

export default router;
