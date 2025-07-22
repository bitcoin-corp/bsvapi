#!/usr/bin/env node

const { logger } = require('./src/utils/logger');

console.log('🚀 Starting BSV Micropayments API...');
console.log('📦 Loading dependencies...');

// Set development environment
process.env.NODE_ENV = 'development';

// Start the application
const app = require('./src/index');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

console.log('✅ Application started successfully!');
console.log('📚 API Documentation: http://localhost:3000/api-docs');
console.log('🏥 Health Check: http://localhost:3000/health'); 