#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up BSV Micropayments API...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  const envExamplePath = path.join(__dirname, '..', 'env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created from env.example');
  } else {
    console.log('❌ env.example not found');
    process.exit(1);
  }
} else {
  console.log('✅ .env file already exists');
}

// Create logs directory
const logsPath = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsPath)) {
  console.log('📁 Creating logs directory...');
  fs.mkdirSync(logsPath, { recursive: true });
  console.log('✅ Logs directory created');
} else {
  console.log('✅ Logs directory already exists');
}

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed');
} catch (error) {
  console.log('❌ Failed to install dependencies');
  process.exit(1);
}

// Check if MongoDB is running
console.log('🔍 Checking MongoDB connection...');
try {
  execSync('mongosh --eval "db.runCommand(\'ping\')"', { stdio: 'ignore' });
  console.log('✅ MongoDB is running');
} catch (error) {
  console.log('⚠️  MongoDB is not running. Please start MongoDB:');
  console.log('   mongod');
}

// Check if Redis is running
console.log('🔍 Checking Redis connection...');
try {
  execSync('redis-cli ping', { stdio: 'ignore' });
  console.log('✅ Redis is running');
} catch (error) {
  console.log('⚠️  Redis is not running. Please start Redis:');
  console.log('   redis-server');
}

console.log('\n🎉 Setup completed!');
console.log('\n📋 Next steps:');
console.log('1. Start MongoDB: mongod');
console.log('2. Start Redis: redis-server');
console.log('3. Start the application: npm run dev');
console.log('4. Visit: http://localhost:3000/api-docs');
console.log('\n🔑 Default admin credentials:');
console.log('   Email: admin@bsvapi.com');
console.log('   Password: admin123');
console.log('\n📚 Documentation: README.md'); 