const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const User = require('../models/User');

/**
 * Authenticate JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid authentication token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.currentUser = decoded;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your authentication token has expired. Please login again.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided authentication token is invalid.'
      });
    }

    logger.error('Token authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to authenticate token'
    });
  }
};

/**
 * Authenticate API key
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide a valid API key'
      });
    }

    const user = await User.findByApiKey(apiKey);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or has been revoked'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account disabled',
        message: 'Your account has been disabled'
      });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role
    };

    next();

  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to authenticate API key'
    });
  }
};

/**
 * Require specific role
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }

    next();

  } catch (error) {
    // Don't fail on token errors, just continue without user
    next();
  }
};

/**
 * Verify user exists and is active
 */
const verifyUser = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Please authenticate first'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account disabled',
        message: 'Your account has been disabled'
      });
    }

    req.currentUser = user;
    next();

  } catch (error) {
    logger.error('User verification error:', error);
    res.status(500).json({
      error: 'Verification error',
      message: 'Failed to verify user'
    });
  }
};

module.exports = {
  authenticateToken,
  authenticateApiKey,
  requireRole,
  optionalAuth,
  verifyUser
}; 