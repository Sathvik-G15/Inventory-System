const mongoose = require('mongoose');
require('dotenv').config();

async function importMonitor() {
  try {
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/invenai');
    console.log('Connected to MongoDB');
    
    const Category = mongoose.model('Category');
    const Location = mongoose.model('Location');
    const Product = mongoose.model('Product');
    
    // Get the Electronics category
    const electronicsCategory = await Category.findOne({ name: 'Electronics' });
    if (!electronicsCategory) {
      throw new Error('Electronics category not found');
    }
    
    // Get the first location
    const location = await Location.findOne();
    if (!location) {
      throw new Error('No locations found');
    }
    
    // Create the monitor product
    const monitor = {
      name: '27" 4K Monitor',
      sku: 'MON-4K27-01',
      description: '4K UHD LED monitor with HDR',
      category: electronicsCategory._id,
      location: location._id,
      price: 349.99,
      cost: 250.00,
      stockLevel: 25,
      minStockLevel: 5,
      maxStockLevel: 50,
      barcode: '012345678903',
      qrCode: 'QR_MON_4K27_01',
      rfidTag: 'RFID_004',
      weight: 7.5,
      dimensions: { length: 61.1, width: 23.5, height: 42.4 },
      supplier: {
        name: 'MonitorTech Inc.',
        contact: '+1-800-MON-TECH',
        email: 'sales@monitortech.com'
      },
      images: ['/api/images/monitor-4k-27.jpg']
    };
    
    // Check if product already exists
    const existingProduct = await Product.findOne({ sku: 'MON-4K27-01' });
    if (existingProduct) {
      console.log('Updating existing product:', existingProduct._id);
      await Product.findByIdAndUpdate(existingProduct._id, monitor);
    } else {
      console.log('Creating new product');
      await Product.create(monitor);
    }
    
    console.log('27" 4K Monitor has been added/updated in the database');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

importMonitor();
