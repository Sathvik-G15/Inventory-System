/* global use, db, ObjectId */
// StockWise: Seed categories, locations, products, and sales history directly in MongoDB
// Run with:
// - VS Code MongoDB Playground: click Play
// - mongosh: mongosh --file seed-stockwise.mongodb.js

use('invenai');

function oid(id) {
  try { return new ObjectId(id); } catch (_) { return undefined; }
}

function upsert(coll, filter, doc) {
  const set = { ...doc, updatedAt: new Date() };
  // Do not allow conflicts: createdAt only in $setOnInsert; _id never in $set
  delete set.createdAt;
  delete set._id;
  const setOnInsert = { createdAt: (doc && doc.createdAt) ? doc.createdAt : new Date() };
  return db.getCollection(coll).updateOne(
    filter,
    { $set: set, $setOnInsert: setOnInsert },
    { upsert: true }
  );
}

function ensureCategory({_id, name, description = '', color = '#999', icon = 'box'}) {
  const filter = _id ? { _id: oid(_id) } : { name };
  const doc = { _id: _id ? oid(_id) : undefined, name, description, color, icon, isActive: true };
  upsert('categories', filter, doc);
  return db.getCollection('categories').findOne(filter);
}

function ensureLocation({_id, name, address = '', city = '', state = '', country = '', coordinates, manager = '', capacity = 1000}) {
  const filter = _id ? { _id: oid(_id) } : { name };
  const doc = { _id: _id ? oid(_id) : undefined, name, address, city, state, country, coordinates, manager, capacity, isActive: true };
  upsert('locations', filter, doc);
  return db.getCollection('locations').findOne(filter);
}

function ensureProduct(p) {
  const filter = p._id ? { _id: oid(p._id) } : (p.sku ? { sku: p.sku } : { name: p.name });
  const doc = { ...p };
  if (p._id) doc._id = oid(p._id);
  if (p.category) doc.category = String(p.category);
  if (p.location) doc.location = String(p.location);
  doc.isActive = (p.isActive !== false);
  doc.images = Array.isArray(p.images) ? p.images : [];
  if (typeof doc.expiryDate === 'string') doc.expiryDate = new Date(doc.expiryDate);
  upsert('products', filter, doc);
  return db.getCollection('products').findOne(filter);
}

function seedSalesForProduct(product, { days = 60, maxPerDay = 8, density = 0.9 } = {}) {
  const coll = db.getCollection('saleshistories');
  const pid = String(product._id);
  const price = Number(product.price) || 10;
  const locId = product.location ? String(product.location) : undefined;

  // Clear overlapping recent window to avoid duplicates
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  coll.deleteMany({ productId: pid, date: { $gte: cutoff } });

  const bulk = [];
  for (let i = days - 1; i >= 0; i--) {
    if (Math.random() > density) continue;
    const quantity = Math.floor(Math.random() * maxPerDay) + 1;
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    bulk.push({
      insertOne: {
        document: {
          productId: pid,
          quantity,
          price,
          revenue: quantity * price,
          date,
          locationId: locId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }
    });
  }
  if (bulk.length) coll.bulkWrite(bulk);
  return { productId: pid, inserted: bulk.length };
}

// --- Seed data ---

// Categories (preserve your IDs)
const catBeverages = ensureCategory({
  _id: '68a1b1069e4fde6cd60b6965',
  name: 'Beverages',
  description: 'All non-alcoholic beverages',
  color: '#10B981',
  icon: 'cup'
});

const catHealthcare = ensureCategory({
  _id: '68a1b1069e4fde6cd60b6967',
  name: 'Healthcare',
  description: 'Healthcare products',
  color: '#EF4444',
  icon: 'heart'
});

// Locations (preserve your IDs)
const locMain = ensureLocation({
  _id: '68a1b1069e4fde6cd60b696c',
  name: 'Main Store',
  address: '123 Market Street',
  city: 'City Center',
  state: 'ST',
  country: 'Country',
  manager: 'Alice Manager',
  capacity: 10000
});

const locHealth = ensureLocation({
  _id: '68a1b1069e4fde6cd60b696e',
  name: 'Health Hub',
  address: '456 Wellness Ave',
  city: 'Uptown',
  state: 'ST',
  country: 'Country',
  manager: 'Bob Supervisor',
  capacity: 8000
});

// Your products (preserve given IDs and fields)
const p1 = ensureProduct({
  _id: '68a1cbb14bc233fa5eb93d41',
  name: 'Non-alcoholic',
  sku: 'JF-Q2GO7W',
  description: 'All Non-alcoholic products',
  category: catBeverages._id,
  location: locMain._id,
  price: 2000,
  cost: 0,
  stockLevel: 2000,
  minStockLevel: 200,
  maxStockLevel: 10000,
  images: [],
  isActive: true,
  expiryDate: new Date('2025-08-23T00:00:00Z'),
});

const p2 = ensureProduct({
  _id: '68a1d147396051090b628669',
  name: 'Healthcare products',
  sku: 'JKN-4UVVQS',
  description: 'Healthcare products',
  category: catHealthcare._id,
  location: locHealth._id,
  price: 100,
  cost: 10000,
  stockLevel: 1000,
  minStockLevel: 1000,
  maxStockLevel: 1000000,
  images: [],
  isActive: true,
});

// Extra products
const p3 = ensureProduct({
  name: 'Energy Drink 330ml',
  sku: 'EN-DRINK-330',
  description: 'Caffeinated non-alcoholic beverage',
  category: catBeverages._id,
  location: locMain._id,
  price: 2.5,
  cost: 1.0,
  stockLevel: 500,
  minStockLevel: 50,
  maxStockLevel: 5000,
  expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
  images: [],
  isActive: true,
});

const p4 = ensureProduct({
  name: 'Bandages Pack (50)',
  sku: 'HL-BAND-50',
  description: 'Medical adhesive bandages',
  category: catHealthcare._id,
  location: locHealth._id,
  price: 5.0,
  cost: 2.0,
  stockLevel: 800,
  minStockLevel: 100,
  maxStockLevel: 10000,
  images: [],
  isActive: true,
});

// Sales history for last 60 days
const products = [p1, p2, p3, p4].filter(Boolean);
const results = [];
for (const prod of products) {
  results.push(seedSalesForProduct(prod, { days: 60, maxPerDay: 12, density: 0.9 }));
}

// Output summary
printjson({
  categories: db.getCollection('categories').countDocuments({}),
  locations: db.getCollection('locations').countDocuments({}),
  products: db.getCollection('products').countDocuments({}),
  salesInsertedPerProduct: results
});