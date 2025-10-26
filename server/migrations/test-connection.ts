import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  try {
    // Use 127.0.0.1 instead of localhost for Windows compatibility
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/invenai?retryWrites=true&w=majority';
    console.log('Attempting to connect to MongoDB at:', mongoUrl);
    
    // Set connection options
    const options: mongoose.ConnectOptions = {
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };
    
    // Try to connect
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, options);
    console.log('Successfully connected to MongoDB');
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nAvailable collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Count documents in each collection
    console.log('\nDocument counts:');
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`- ${collection.name}: ${count} documents`);
    }
    
  } catch (error) {
    console.error('\n=== MongoDB Connection Error ===');
    console.error('Error details:', error);
    
    if (error instanceof Error) {
      if (error.name === 'MongooseServerSelectionError') {
        console.error('\nPossible causes:');
        console.error('1. MongoDB is not running');
        console.error('2. Incorrect connection string');
        console.error('3. Network connectivity issues');
        console.error('\nTo start MongoDB on Windows:');
        console.error('1. Open Services (services.msc)');
        console.error('2. Find "MongoDB" service');
        console.error('3. Right-click and select "Start"');
      }
    }
    
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testConnection().catch(console.error);
