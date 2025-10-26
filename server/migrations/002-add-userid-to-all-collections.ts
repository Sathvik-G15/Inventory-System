import mongoose from 'mongoose';
import { User, Product, Category, Location, Supplier } from '../shared/mongodb-schema';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/invenai';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    // Get the first admin user or create one if none exists
    let adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.log('No admin user found, creating one...');
      adminUser = await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
        isActive: true
      });
      console.log('Created admin user with ID:', adminUser._id);
    }

    const defaultUserId = adminUser._id;
    console.log('Using user ID for migration:', defaultUserId);

    // Update products
    const productsResult = await Product.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: defaultUserId } }
    );
    console.log(`Updated ${productsResult.modifiedCount} products`);

    // Update categories
    const categoriesResult = await Category.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: defaultUserId } }
    );
    console.log(`Updated ${categoriesResult.modifiedCount} categories`);

    // Update locations
    const locationsResult = await Location.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: defaultUserId } }
    );
    console.log(`Updated ${locationsResult.modifiedCount} locations`);

    // Update suppliers
    const suppliersResult = await Supplier.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: defaultUserId } }
    );
    console.log(`Updated ${suppliersResult.modifiedCount} suppliers`);

    console.log('Migration completed successfully');
    
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
