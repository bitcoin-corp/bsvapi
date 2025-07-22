const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const { logger } = require('./utils/logger');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
// const { setupSwagger } = require('./config/swagger');

// Import routes
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const apiRoutes = require('./routes/apis');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'BSV Micropayments API',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/apis', apiRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Setup Swagger documentation
// setupSwagger(app);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
async function startServer() {
  try {
    // Connect to database (optional in development)
    try {
      await connectDB();
      logger.info('Database connected successfully');
    } catch (dbError) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Database connection failed, running in development mode without database');
        logger.warn('Some features may not work properly');
      } else {
        throw dbError;
      }
    }

    // Connect to Redis (optional in development)
    try {
      await connectRedis();
      logger.info('Redis connected successfully');
    } catch (redisError) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Redis connection failed, running in development mode without Redis');
        logger.warn('Rate limiting will use memory fallback');
      } else {
        throw redisError;
      }
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`BSV Micropayments API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check available at: http://localhost:${PORT}/health`);
      if (process.env.NODE_ENV === 'development') {
        logger.info('⚠️  Running in development mode - some features may be limited');
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app; 