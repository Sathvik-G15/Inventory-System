import mongoose from 'mongoose';
import { Product } from '../../shared/mongodb-schema';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/invenai';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    // Get all products without a userId
    const products = await Product.find({ userId: { $exists: false } });
    
    if (products.length === 0) {
      console.log('No products need migration');
      return;
    }

    console.log(`Found ${products.length} products to migrate`);
    
    // Update each product with a default userId
    // In a real scenario, you'd want to map these to actual users
    const defaultUserId = '000000000000000000000001'; // Default admin user ID
    
    const result = await Product.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: defaultUserId } }
    );
    
    console.log(`Successfully migrated ${result.modifiedCount} products`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrate().then(() => {
  console.log('Migration completed');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
