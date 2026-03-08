const { RateLimiterRedis } = require('rate-limiter-flexible');
const { getRedisClient } = require('../config/redis');
const { logger } = require('../utils/logger');

// Create rate limiter instances
const createRateLimiter = (keyPrefix, points, duration) => {
  const redisClient = getRedisClient();
  if (!redisClient) {
    // Fallback to memory-based rate limiting if Redis is not available
    console.warn('Redis not available, using memory-based rate limiting');
    return null;
  }
  
  try {
    return new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix,
      points, // Number of requests
      duration, // Per duration in seconds
      blockDuration: 60 * 15, // Block for 15 minutes,
    });
  } catch (error) {
    console.warn('Failed to create Redis rate limiter, using memory fallback:', error.message);
    return null;
  }
};

// Rate limiters for different endpoints
let authLimiter = null;
let apiLimiter = null;
let paymentLimiter = null;
let adminLimiter = null;

// Initialize rate limiters when needed
const initRateLimiters = () => {
  if (!authLimiter) authLimiter = createRateLimiter('auth', 5, 60);
  if (!apiLimiter) apiLimiter = createRateLimiter('api', 100, 60);
  if (!paymentLimiter) paymentLimiter = createRateLimiter('payment', 10, 60);
  if (!adminLimiter) adminLimiter = createRateLimiter('admin', 50, 60);
};

/**
 * Generic rate limiter middleware
 */
const rateLimiter = (type, points, duration) => {
  const limiter = createRateLimiter(type, points, duration);
  
  return async (req, res, next) => {
    try {
      const key = req.user ? req.user.userId : req.ip;
      await limiter.consume(key);
      next();
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${secs} seconds.`,
        retryAfter: secs
      });
    }
  };
};

/**
 * Authentication rate limiter
 */
const authRateLimiter = async (req, res, next) => {
  try {
    initRateLimiters();
    if (!authLimiter) {
      // Skip rate limiting if Redis is not available
      return next();
    }
    const key = req.ip;
    await authLimiter.consume(key);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: `Too many login attempts. Try again in ${secs} seconds.`,
      retryAfter: secs
    });
  }
};

/**
 * API rate limiter
 */
const apiRateLimiter = async (req, res, next) => {
  try {
    initRateLimiters();
    if (!apiLimiter) {
      // Skip rate limiting if Redis is not available
      return next();
    }
    const key = req.user ? req.user.userId : req.ip;
    await apiLimiter.consume(key);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'API rate limit exceeded',
      message: `Too many API requests. Try again in ${secs} seconds.`,
      retryAfter: secs
    });
  }
};

/**
 * Payment rate limiter
 */
const paymentRateLimiter = async (req, res, next) => {
  try {
    initRateLimiters();
    if (!paymentLimiter) {
      // Skip rate limiting if Redis is not available
      return next();
    }
    const key = req.user ? req.user.userId : req.ip;
    await paymentLimiter.consume(key);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Payment rate limit exceeded',
      message: `Too many payment requests. Try again in ${secs} seconds.`,
      retryAfter: secs
    });
  }
};

/**
 * Admin rate limiter
 */
const adminRateLimiter = async (req, res, next) => {
  try {
    const key = req.user ? req.user.userId : req.ip;
    await adminLimiter.consume(key);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Admin rate limit exceeded',
      message: `Too many admin requests. Try again in ${secs} seconds.`,
      retryAfter: secs
    });
  }
};

/**
 * Dynamic rate limiter based on user tier
 */
const dynamicRateLimiter = async (req, res, next) => {
  try {
    if (!req.user) {
      // Anonymous users get basic rate limit
      const key = req.ip;
      await apiLimiter.consume(key);
      return next();
    }

    // Get user's rate limit based on their tier
    const userTier = req.user.role || 'user';
    let points, duration;

    switch (userTier) {
      case 'admin':
        points = 1000;
        duration = 60;
        break;
      case 'premium':
        points = 500;
        duration = 60;
        break;
      case 'user':
      default:
        points = 100;
        duration = 60;
        break;
    }

    const limiter = createRateLimiter(`dynamic_${userTier}`, points, duration);
    const key = req.user.userId;
    await limiter.consume(key);
    next();

  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests for your tier. Try again in ${secs} seconds.`,
      retryAfter: secs
    });
  }
};

/**
 * IP-based rate limiter for public endpoints
 */
const ipRateLimiter = (points, duration) => {
  const limiter = createRateLimiter('ip', points, duration);
  
  return async (req, res, next) => {
    try {
      const key = req.ip;
      await limiter.consume(key);
      next();
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests from this IP. Try again in ${secs} seconds.`,
        retryAfter: secs
      });
    }
  };
};

/**
 * Burst rate limiter for high-frequency endpoints
 */
const burstRateLimiter = (points, duration, burstPoints, burstDuration) => {
  const limiter = createRateLimiter('burst', points, duration);
  const burstLimiter = createRateLimiter('burst_short', burstPoints, burstDuration);
  
  return async (req, res, next) => {
    try {
      const key = req.user ? req.user.userId : req.ip;
      
      // Check both regular and burst limits
      await Promise.all([
        limiter.consume(key),
        burstLimiter.consume(key)
      ]);
      
      next();
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).json({
        error: 'Burst rate limit exceeded',
        message: `Too many rapid requests. Try again in ${secs} seconds.`,
        retryAfter: secs
      });
    }
  };
};

// Developer rate limiter (same as API rate limiter)
const developerRateLimiter = apiRateLimiter;

// Supplier rate limiter (same as API rate limiter)
const supplierRateLimiter = apiRateLimiter;

module.exports = {
  rateLimiter,
  authRateLimiter,
  apiRateLimiter,
  paymentRateLimiter,
  adminRateLimiter,
  developerRateLimiter,
  supplierRateLimiter,
  dynamicRateLimiter,
  ipRateLimiter,
  burstRateLimiter
}; 