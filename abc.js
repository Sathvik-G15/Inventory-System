// 1. Define the specified USER_ID
const USER_ID = "68f9054d5e75756c0e168ad4";

// --- START INSERTIONS ---

// 2. Create 6 Locations
print("--- 1. Inserting 6 Locations ---");
const loc_wh_east = new ObjectId();
const loc_wh_west = new ObjectId();
const loc_wh_cold = new ObjectId();
const loc_shop_flagship = new ObjectId();
const loc_shop_suburban = new ObjectId();
const loc_shop_online_pick = new ObjectId();

db.locations.insertMany([
    {
        _id: loc_wh_east,
        userId: USER_ID,
        name: "Eastern Regional Warehouse",
        type: "warehouse",
        address: "300 Logistics Drive, Newark, NJ",
        city: "Newark",
        state: "NJ",
        country: "USA",
        manager: "Dave East",
        capacity: 90000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: loc_wh_west,
        userId: USER_ID,
        name: "Western Cross-Dock Facility",
        type: "warehouse",
        address: "15 Transpo Way, Fresno, CA",
        city: "Fresno",
        state: "CA",
        country: "USA",
        manager: "Carol West",
        capacity: 65000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: loc_wh_cold,
        userId: USER_ID,
        name: "Cold Storage/Perishables",
        type: "warehouse",
        address: "5 Refrig Lane, Chicago, IL",
        city: "Chicago",
        state: "IL",
        country: "USA",
        manager: "Ice T.",
        capacity: 15000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: loc_shop_flagship,
        userId: USER_ID,
        name: "Downtown Flagship Retail Store",
        type: "shop",
        address: "100 Main St, New York, NY",
        city: "New York",
        state: "NY",
        country: "USA",
        manager: "Sam Flag",
        capacity: 5000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: loc_shop_suburban,
        userId: USER_ID,
        name: "Suburban Mall Kiosk",
        type: "shop",
        address: "700 Mall Blvd, Paramus, NJ",
        city: "Paramus",
        state: "NJ",
        country: "USA",
        manager: "Katy Kiosk",
        capacity: 800,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: loc_shop_online_pick,
        userId: USER_ID,
        name: "Online Order Pick-up Center",
        type: "warehouse", // Technically a warehouse/fulfillment center
        address: "22 Web Street, Seattle, WA",
        city: "Seattle",
        state: "WA",
        country: "USA",
        manager: "Neil Pick",
        capacity: 12000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);


// 3. Create 6 Categories
print("\n--- 2. Inserting 6 Categories ---");
const cat_electronics = new ObjectId();
const cat_perishables = new ObjectId();
const cat_home_decor = new ObjectId();
const cat_hardware = new ObjectId();
const cat_apparel = new ObjectId();
const cat_media = new ObjectId();

db.categories.insertMany([
    {
        _id: cat_electronics,
        userId: USER_ID,
        name: "Electronics & Gadgets",
        description: "High-value consumer devices and accessories.",
        color: "#007bff",
        icon: "monitor",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: cat_perishables,
        userId: USER_ID,
        name: "Perishable Goods",
        description: "Items requiring cold storage and strict expiry tracking.",
        color: "#28a745",
        icon: "food",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: cat_home_decor,
        userId: USER_ID,
        name: "Home & Garden Decor",
        description: "Furniture, artwork, and outdoor supplies.",
        color: "#fd7e14",
        icon: "chair",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: cat_hardware,
        userId: USER_ID,
        name: "Tools & Hardware",
        description: "Maintenance, construction, and repair equipment.",
        color: "#6c757d",
        icon: "hammer",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: cat_apparel,
        userId: USER_ID,
        name: "Apparel & Accessories",
        description: "Clothing, shoes, and wearable items.",
        color: "#e83e8c",
        icon: "tshirt",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: cat_media,
        userId: USER_ID,
        name: "Books & Media",
        description: "Physical media like books, DVDs, and vinyl.",
        color: "#6f42c1",
        icon: "book",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);

// 4. Create 3 Key Suppliers
print("\n--- 3. Inserting 3 Key Suppliers ---");
const techSuppId = new ObjectId();
const foodSuppId = new ObjectId();
const homeSuppId = new ObjectId();

db.suppliers.insertMany([
    {
        _id: techSuppId,
        userId: USER_ID,
        name: "Future Electronics Corp.",
        contactPerson: "Eliza Watts",
        email: "sales@futurelec.com",
        phone: "+1-555-5001",
        address: "200 Circuit Way, San Jose, CA",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: foodSuppId,
        userId: USER_ID,
        name: "Fresh Goods Distribution",
        contactPerson: "Gus Fring",
        email: "orders@freshgoods.net",
        phone: "+1-555-5002",
        address: "15 Farm Road, Lancaster, PA",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: homeSuppId,
        userId: USER_ID,
        name: "Universal Import & Supply",
        contactPerson: "Tina Home",
        email: "tina@universal-supply.biz",
        phone: "+1-555-5003",
        address: "88 Harbor Ave, Miami, FL",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);


// 5. Create 15 Products
print("\n--- 4. Inserting 15 Products ---");

db.products.insertMany([
    // ELECTRONICS (6 Products - High Value/High Tech)
    {
        userId: USER_ID, name: "4K Smart Display 55 inch", sku: "ELEC-TV-4K", category: cat_electronics.toString(), location: loc_wh_east.toString(), price: 799.99, cost: 450.00, stockLevel: 45, minStockLevel: 10, arduinoSensorId: "WH-E-ENV-01",
        supplier: { name: "Future Electronics Corp.", contact: "Eliza Watts", email: "sales@futurelec.com" }, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "Wireless Noise-Cancelling Headphones", sku: "ELEC-HP-NC", category: cat_electronics.toString(), location: loc_shop_flagship.toString(), price: 249.00, cost: 110.00, stockLevel: 80, minStockLevel: 25,
        supplier: { name: "Future Electronics Corp.", contact: "Eliza Watts", email: "sales@futurelec.com" }, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "Smart Inventory Weight Sensor", sku: "ELEC-IOT-WGT", category: cat_electronics.toString(), location: loc_wh_west.toString(), price: 59.99, cost: 20.00, stockLevel: 300, minStockLevel: 100, arduinoSensorId: "ARD-WGT-99",
        supplier: { name: "Future Electronics Corp.", contact: "Eliza Watts", email: "sales@futurelec.com" }, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "USB-C Fast Charger (100W)", sku: "ELEC-CHR-100", category: cat_electronics.toString(), location: loc_shop_suburban.toString(), price: 45.00, cost: 15.00, stockLevel: 120, minStockLevel: 50, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "Mini Portable Projector", sku: "ELEC-PRO-MINI", category: cat_electronics.toString(), location: loc_wh_east.toString(), price: 199.99, cost: 85.00, stockLevel: 60, minStockLevel: 20, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "RFID Asset Tag Starter Pack", sku: "ELEC-RFID-TAG", category: cat_electronics.toString(), location: loc_wh_west.toString(), price: 120.00, cost: 40.00, stockLevel: 150, minStockLevel: 50, rfidTag: "RFID-BULK-33", isActive: true, createdAt: new Date(), updatedAt: new Date()
    },

    // PERISHABLES (3 Products - Requires Expiry)
    {
        userId: USER_ID, name: "Organic Coffee Beans (1kg)", sku: "PERI-CFE-OG", category: cat_perishables.toString(), location: loc_wh_cold.toString(), price: 29.99, cost: 15.00, stockLevel: 500, minStockLevel: 150, expiryDate: new Date("2025-12-31"),
        supplier: { name: "Fresh Goods Distribution", contact: "Gus Fring", email: "orders@freshgoods.net" }, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "Artisanal Cheese Wheel", sku: "PERI-CHS-ART", category: cat_perishables.toString(), location: loc_wh_cold.toString(), price: 45.00, cost: 25.00, stockLevel: 80, minStockLevel: 30, expiryDate: new Date("2025-11-15"),
        supplier: { name: "Fresh Goods Distribution", contact: "Gus Fring", email: "orders@freshgoods.net" }, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "Fresh Baguettes (Pack of 4)", sku: "PERI-BRD-BAG", category: cat_perishables.toString(), location: loc_shop_flagship.toString(), price: 8.00, cost: 3.50, stockLevel: 50, minStockLevel: 10, expiryDate: new Date("2025-10-28"), isActive: true, createdAt: new Date(), updatedAt: new Date()
    },

    // HOME & HARDWARE (4 Products)
    {
        userId: USER_ID, name: "Adjustable Standing Desk", sku: "HOME-DSK-ADJ", category: cat_home_decor.toString(), location: loc_wh_west.toString(), price: 399.00, cost: 180.00, stockLevel: 25, minStockLevel: 5,
        supplier: { name: "Universal Import & Supply", contact: "Tina Home", email: "tina@universal-supply.biz" }, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "Ceramic Planter Set (Small)", sku: "HOME-PLT-CER", category: cat_home_decor.toString(), location: loc_shop_suburban.toString(), price: 29.99, cost: 10.00, stockLevel: 150, minStockLevel: 40, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "Heavy Duty Impact Drill", sku: "HARD-TOL-IMP", category: cat_hardware.toString(), location: loc_wh_east.toString(), price: 149.00, cost: 70.00, stockLevel: 90, minStockLevel: 30, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "Assorted Screw & Nail Kit (1000pc)", sku: "HARD-FX-KIT", category: cat_hardware.toString(), location: loc_wh_west.toString(), price: 19.99, cost: 8.00, stockLevel: 400, minStockLevel: 100, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },

    // APPAREL & MEDIA (2 Products)
    {
        userId: USER_ID, name: "Unisex Cotton Hoodie (Large, Blue)", sku: "APPR-HOD-BLU", category: cat_apparel.toString(), location: loc_shop_online_pick.toString(), price: 65.00, cost: 25.00, stockLevel: 180, minStockLevel: 50, isActive: true, createdAt: new Date(), updatedAt: new Date()
    },
    {
        userId: USER_ID, name: "The Great Gatsby (Hardcover)", sku: "MEDIA-BOOK-GG", category: cat_media.toString(), location: loc_shop_online_pick.toString(), price: 15.00, cost: 6.00, stockLevel: 350, minStockLevel: 100, isActive: true, createdAt: new Date(), updatedAt: new Date()
    }
]);

print("\nSample Data Insertion Complete.");
print("Total Documents Inserted: 6 Locations, 6 Categories, 3 Suppliers, 15 Products.");