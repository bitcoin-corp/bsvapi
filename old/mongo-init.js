// MongoDB initialization script
db = db.getSiblingDB('bsvapi');

// Create collections
db.createCollection('users');
db.createCollection('payments');
db.createCollection('apiservices');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "apiKey": 1 }, { unique: true, sparse: true });
db.users.createIndex({ "bsvAddress": 1 }, { unique: true, sparse: true });

db.payments.createIndex({ "paymentId": 1 }, { unique: true });
db.payments.createIndex({ "userId": 1 });
db.payments.createIndex({ "status": 1 });
db.payments.createIndex({ "createdAt": -1 });

db.apiservices.createIndex({ "slug": 1 }, { unique: true });
db.apiservices.createIndex({ "category": 1 });
db.apiservices.createIndex({ "status": 1 });

// Create admin user
db.users.insertOne({
  email: "admin@bsvapi.com",
  username: "admin",
  firstName: "Admin",
  lastName: "User",
  password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8e", // "admin123"
  role: "admin",
  isActive: true,
  isVerified: true,
  apiKey: "bsv_admin_1234567890abcdef",
  balance: 0,
  settings: {
    notifications: {
      email: true,
      push: false
    },
    privacy: {
      shareUsageData: false
    }
  },
  createdAt: new Date(),
  updatedAt: new Date()
});

print("MongoDB initialization completed successfully!"); 