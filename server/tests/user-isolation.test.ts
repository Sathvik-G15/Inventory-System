import mongoose from 'mongoose';
import { User, Product } from '../../shared/mongodb-schema';
import { mongoStorage } from '../mongodb-storage';
import dotenv from 'dotenv';

dotenv.config();

describe('User Isolation Tests', () => {
  let testUser1: any;
  let testUser2: any;

  beforeAll(async () => {
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/invenai_test';
    await mongoose.connect(mongoUrl);
    
    // Create test users
    testUser1 = await User.create({
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'password123',
      role: 'employee'
    });

    testUser2 = await User.create({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'password123',
      role: 'employee'
    });
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ username: { $in: ['testuser1', 'testuser2'] } });
    await Product.deleteMany({ name: { $regex: '^Test Product' } });
    await mongoose.disconnect();
  });

  it('should create products scoped to specific users', async () => {
    // Create products for user 1
    const product1 = await mongoStorage.createProduct({
      userId: testUser1._id,
      name: 'Test Product 1',
      sku: 'TEST-001',
      category: 'test-category',
      price: 100,
      stockLevel: 10
    });

    // Create products for user 2 with same SKU (should be allowed)
    const product2 = await mongoStorage.createProduct({
      userId: testUser2._id,
      name: 'Test Product 2',
      sku: 'TEST-001', // Same SKU as product1 but different user
      category: 'test-category',
      price: 200,
      stockLevel: 20
    });

    // Verify products were created
    expect(product1).toBeDefined();
    expect(product2).toBeDefined();
    expect(product1.sku).toBe('TEST-001');
    expect(product2.sku).toBe('TEST-001');
    expect(product1.userId.toString()).toBe(testUser1._id.toString());
    expect(product2.userId.toString()).toBe(testUser2._id.toString());
  });

  it('should not allow duplicate SKUs for the same user', async () => {
    // Create initial product
    await mongoStorage.createProduct({
      userId: testUser1._id,
      name: 'Test Product 3',
      sku: 'TEST-003',
      category: 'test-category',
      price: 100,
      stockLevel: 10
    });

    // Try to create product with same SKU for same user (should fail)
    await expect(
      mongoStorage.createProduct({
        userId: testUser1._id,
        name: 'Test Product 3 Duplicate',
        sku: 'TEST-003', // Same SKU as above for same user
        category: 'test-category',
        price: 100,
        stockLevel: 10
      })
    ).rejects.toThrow();
  });

  it('should only return products for the requesting user', async () => {
    // Create products for both users
    await Promise.all([
      mongoStorage.createProduct({
        userId: testUser1._id,
        name: 'Test Product 4',
        sku: 'TEST-004',
        category: 'test-category',
        price: 100,
        stockLevel: 10
      }),
      mongoStorage.createProduct({
        userId: testUser2._id,
        name: 'Test Product 5',
        sku: 'TEST-005',
        category: 'test-category',
        price: 200,
        stockLevel: 20
      })
    ]);

    // Get products for user 1
    const user1Products = await mongoStorage.getProducts({ userId: testUser1._id });
    expect(user1Products).toHaveLength(2); // Should only see their own products
    expect(user1Products.every((p: any) => p.userId.toString() === testUser1._id.toString())).toBe(true);

    // Get products for user 2
    const user2Products = await mongoStorage.getProducts({ userId: testUser2._id });
    expect(user2Products).toHaveLength(2); // Should only see their own products
    expect(user2Products.every((p: any) => p.userId.toString() === testUser2._id.toString())).toBe(true);
  });

  it('should not allow accessing other users\' products', async () => {
    // Create product for user 1
    const product = await mongoStorage.createProduct({
      userId: testUser1._id,
      name: 'Test Product 6',
      sku: 'TEST-006',
      category: 'test-category',
      price: 100,
      stockLevel: 10
    });

    // Try to get product as user 2 (should not be found)
    const foundProduct = await mongoStorage.getProduct(product._id, testUser2._id);
    expect(foundProduct).toBeNull();

    // Try to update product as user 2 (should not be found)
    const updatedProduct = await mongoStorage.updateProduct(
      product._id,
      { name: 'Hacked Product' },
      testUser2._id
    );
    expect(updatedProduct).toBeNull();

    // Try to delete product as user 2 (should fail)
    const deleteResult = await mongoStorage.deleteProduct(product._id, testUser2._id);
    expect(deleteResult).toBe(false);
  });
});
