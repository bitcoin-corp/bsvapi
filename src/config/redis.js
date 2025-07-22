const redis = require('redis');
const { logger } = require('../utils/logger');

let redisClient = null;

const connectRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true
      }
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        logger.warn('Redis server not available, continuing without Redis');
        redisClient = null;
        return;
      }
      logger.error('Redis client error:', err);
    });

    redisClient.on('end', () => {
      logger.warn('Redis client connection ended');
    });

    await redisClient.connect();
    
  } catch (error) {
    logger.warn('Redis connection failed, continuing without Redis:', error.message);
    redisClient = null;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    return null;
  }
  return redisClient;
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis client disconnected');
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis
}; 