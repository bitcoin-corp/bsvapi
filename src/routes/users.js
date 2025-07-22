const express = require('express');
const Joi = require('joi');
const { logger } = require('../utils/logger');
const User = require('../models/User');
const { authenticateToken, verifyUser } = require('../middleware/auth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  username: Joi.string().alphanum().min(3).max(30).optional()
});

const updateSettingsSchema = Joi.object({
  notifications: Joi.object({
    email: Joi.boolean().optional(),
    push: Joi.boolean().optional()
  }).optional(),
  privacy: Joi.object({
    shareUsageData: Joi.boolean().optional()
  }).optional()
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 maxLength: 50
 *               lastName:
 *                 type: string
 *                 maxLength: 50
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Username already taken
 */
router.put('/profile', authenticateToken, verifyUser, apiRateLimiter, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { firstName, lastName, username } = value;

    // Check if username is being changed and if it's already taken
    if (username && username !== req.currentUser.username) {
      const usernameExists = await User.usernameExists(username);
      if (usernameExists) {
        return res.status(409).json({
          error: 'Username taken',
          message: 'This username is already taken'
        });
      }
    }

    // Update user profile
    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (username) updates.username = username;

    const updatedUser = await User.findByIdAndUpdate(
      req.currentUser._id,
      updates,
      { new: true, runValidators: true }
    );

    logger.info(`User profile updated: ${req.currentUser.email}`);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        apiKey: updatedUser.apiKey,
        balance: updatedUser.balance,
        isVerified: updatedUser.isVerified,
        lastLogin: updatedUser.lastLogin,
        createdAt: updatedUser.createdAt
      }
    });

  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update profile'
    });
  }
});

/**
 * @swagger
 * /api/users/settings:
 *   put:
 *     summary: Update user settings
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notifications:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   push:
 *                     type: boolean
 *               privacy:
 *                 type: object
 *                 properties:
 *                   shareUsageData:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Validation error
 */
router.put('/settings', authenticateToken, verifyUser, apiRateLimiter, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = updateSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { notifications, privacy } = value;

    // Update user settings
    const updates = {};
    if (notifications) {
      updates['settings.notifications'] = {
        ...req.currentUser.settings.notifications,
        ...notifications
      };
    }
    if (privacy) {
      updates['settings.privacy'] = {
        ...req.currentUser.settings.privacy,
        ...privacy
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.currentUser._id,
      { $set: updates },
      { new: true }
    );

    logger.info(`User settings updated: ${req.currentUser.email}`);

    res.json({
      message: 'Settings updated successfully',
      settings: updatedUser.settings
    });

  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update settings'
    });
  }
});

/**
 * @swagger
 * /api/users/api-key:
 *   post:
 *     summary: Regenerate API key
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: API key regenerated successfully
 */
router.post('/api-key', authenticateToken, verifyUser, apiRateLimiter, async (req, res) => {
  try {
    // Generate new API key
    const newApiKey = req.currentUser.generateApiKey();
    
    // Update user with new API key
    const updatedUser = await User.findByIdAndUpdate(
      req.currentUser._id,
      { apiKey: newApiKey },
      { new: true }
    );

    logger.info(`API key regenerated: ${req.currentUser.email}`);

    res.json({
      message: 'API key regenerated successfully',
      apiKey: newApiKey
    });

  } catch (error) {
    logger.error('Regenerate API key error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to regenerate API key'
    });
  }
});

/**
 * @swagger
 * /api/users/balance:
 *   get:
 *     summary: Get user balance and micropayment channels
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Balance information retrieved successfully
 */
router.get('/balance', authenticateToken, verifyUser, async (req, res) => {
  try {
    const user = await User.findById(req.currentUser._id);
    
    res.json({
      balance: user.balance,
      micropaymentChannels: user.getActiveChannels(),
      currency: 'satoshis'
    });

  } catch (error) {
    logger.error('Get balance error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get balance information'
    });
  }
});

/**
 * @swagger
 * /api/users/micropayment-channels:
 *   post:
 *     summary: Create a new micropayment channel
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - initialBalance
 *             properties:
 *               initialBalance:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       201:
 *         description: Micropayment channel created successfully
 *       400:
 *         description: Insufficient balance
 */
router.post('/micropayment-channels', authenticateToken, verifyUser, apiRateLimiter, async (req, res) => {
  try {
    const { initialBalance } = req.body;

    if (!initialBalance || initialBalance <= 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Initial balance must be greater than 0'
      });
    }

    // Check if user has sufficient balance
    if (req.currentUser.balance < initialBalance) {
      return res.status(400).json({
        error: 'Insufficient balance',
        message: `Insufficient balance. Required: ${initialBalance} satoshis, Available: ${req.currentUser.balance} satoshis`
      });
    }

    // Create micropayment channel
    await req.currentUser.createMicropaymentChannel(initialBalance);
    
    // Deduct balance
    await req.currentUser.deductBalance(initialBalance);

    // Get updated user
    const updatedUser = await User.findById(req.currentUser._id);

    logger.info(`Micropayment channel created: ${req.currentUser.email}, balance: ${initialBalance}`);

    res.status(201).json({
      message: 'Micropayment channel created successfully',
      channel: updatedUser.micropaymentChannels[updatedUser.micropaymentChannels.length - 1],
      newBalance: updatedUser.balance
    });

  } catch (error) {
    logger.error('Create micropayment channel error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create micropayment channel'
    });
  }
});

module.exports = router; 