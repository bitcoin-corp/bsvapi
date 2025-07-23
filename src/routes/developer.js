const express = require('express');
const Joi = require('joi');
const { logger } = require('../utils/logger');
const ApiKey = require('../models/ApiKey');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { authenticateToken, verifyUser } = require('../middleware/auth');
const { developerRateLimiter } = require('../middleware/rateLimiter');
const paymentProcessor = require('../services/payment-processor');

const router = express.Router();

// Validation schemas
const createApiKeySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  permissions: Joi.array().items(Joi.string().valid(
    'payments:create', 'payments:read', 'payments:update', 
    'channels:create', 'channels:read', 'admin:read'
  )).default(['payments:create', 'payments:read']),
  rateLimit: Joi.object({
    requestsPerMinute: Joi.number().min(1).max(1000).default(60),
    requestsPerHour: Joi.number().min(1).max(10000).default(1000),
    requestsPerDay: Joi.number().min(1).max(100000).default(10000)
  }).optional(),
  expiresAt: Joi.date().min('now').optional(),
  ipWhitelist: Joi.array().items(Joi.string().ip()).optional(),
  webhookUrl: Joi.string().uri().optional()
});

const createPaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  description: Joi.string().max(200).required(),
  recipientAddress: Joi.string().required(),
  callbackUrl: Joi.string().uri().optional(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium')
});

/**
 * @swagger
 * /api/developer/keys:
 *   post:
 *     summary: Create a new API key
 *     tags: [Developer]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [payments:create, payments:read, payments:update, channels:create, channels:read, admin:read]
 *               rateLimit:
 *                 type: object
 *                 properties:
 *                   requestsPerMinute:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 1000
 *                   requestsPerHour:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 10000
 *                   requestsPerDay:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 100000
 *     responses:
 *       201:
 *         description: API key created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/keys', authenticateToken, verifyUser, developerRateLimiter, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createApiKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { name, description, permissions, rateLimit, expiresAt, ipWhitelist, webhookUrl } = value;

    // Create API key
    const apiKey = new ApiKey({
      key: ApiKey.generateKey(),
      userId: req.currentUser._id,
      name,
      description,
      permissions,
      rateLimit,
      expiresAt,
      ipWhitelist,
      webhookUrl
    });

    await apiKey.save();

    logger.info(`API key created for user ${req.currentUser._id}: ${apiKey.key}`);

    res.status(201).json({
      success: true,
      apiKey: {
        key: apiKey.key,
        name: apiKey.name,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt
      },
      message: 'API key created successfully'
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create API key'
    });
  }
});

/**
 * @swagger
 * /api/developer/keys:
 *   get:
 *     summary: List all API keys for the current user
 *     tags: [Developer]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *       401:
 *         description: Unauthorized
 */
router.get('/keys', authenticateToken, verifyUser, async (req, res) => {
  try {
    const apiKeys = await ApiKey.find({ userId: req.currentUser._id })
      .select('-key') // Don't return the actual key
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      apiKeys: apiKeys.map(key => ({
        id: key._id,
        name: key.name,
        description: key.description,
        permissions: key.permissions,
        status: key.status,
        usage: key.usage,
        rateLimit: key.rateLimit,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        lastUsed: key.usage.lastUsed
      }))
    });
  } catch (error) {
    logger.error('Error fetching API keys:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch API keys'
    });
  }
});

/**
 * @swagger
 * /api/developer/keys/{keyId}:
 *   delete:
 *     summary: Delete an API key
 *     tags: [Developer]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: API key not found
 */
router.delete('/keys/:keyId', authenticateToken, verifyUser, async (req, res) => {
  try {
    const apiKey = await ApiKey.findOne({
      _id: req.params.keyId,
      userId: req.currentUser._id
    });

    if (!apiKey) {
      return res.status(404).json({
        error: 'Not found',
        message: 'API key not found'
      });
    }

    await ApiKey.deleteOne({ _id: req.params.keyId });

    logger.info(`API key deleted: ${apiKey.key}`);

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting API key:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete API key'
    });
  }
});

/**
 * @swagger
 * /api/developer/payments:
 *   post:
 *     summary: Create a new payment using API key
 *     tags: [Developer]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - description
 *               - recipientAddress
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *               description:
 *                 type: string
 *                 maxLength: 200
 *               recipientAddress:
 *                 type: string
 *               callbackUrl:
 *                 type: string
 *                 format: uri
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *     responses:
 *       201:
 *         description: Payment created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/payments', async (req, res) => {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required'
      });
    }

    // Validate API key
    const keyRecord = await ApiKey.findByKey(apiKey);
    if (!keyRecord || !keyRecord.isActive) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or inactive API key'
      });
    }

    // Check permissions
    if (!keyRecord.hasPermission('payments:create')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    // Check rate limit
    if (!keyRecord.checkRateLimit()) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded'
      });
    }

    // Validate request body
    const { error, value } = createPaymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { amount, description, recipientAddress, callbackUrl, priority } = value;

    // Process payment request
    const paymentResult = await paymentProcessor.processPaymentRequest({
      userId: keyRecord.userId,
      amount,
      description,
      recipientAddress,
      callbackUrl,
      type: 'api_call',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      priority
    });

    // Increment API key usage
    await keyRecord.incrementUsage(amount);

    res.status(201).json({
      success: true,
      payment: paymentResult,
      message: 'Payment request created successfully'
    });
  } catch (error) {
    logger.error('Error creating payment via API:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create payment'
    });
  }
});

/**
 * @swagger
 * /api/developer/payments/{paymentId}:
 *   get:
 *     summary: Get payment status
 *     tags: [Developer]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Payment not found
 */
router.get('/payments/:paymentId', async (req, res) => {
  try {
    // Validate API key
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    const keyRecord = await ApiKey.findByKey(apiKey);
    
    if (!keyRecord || !keyRecord.isActive) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or inactive API key'
      });
    }

    if (!keyRecord.hasPermission('payments:read')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    // Get payment
    const payment = await Payment.findOne({
      paymentId: req.params.paymentId,
      userId: keyRecord.userId
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Payment not found'
      });
    }

    // Increment API key usage
    await keyRecord.incrementUsage();

    res.json({
      success: true,
      payment: {
        paymentId: payment.paymentId,
        status: payment.status,
        amount: payment.amount,
        totalAmount: payment.totalAmount,
        recipientAddress: payment.recipientAddress,
        paymentAddress: payment.paymentAddress,
        transactionId: payment.transactionId,
        confirmations: payment.confirmations,
        fees: payment.fees,
        metadata: payment.metadata,
        createdAt: payment.createdAt,
        confirmedAt: payment.confirmedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching payment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch payment'
    });
  }
});

/**
 * @swagger
 * /api/developer/stats:
 *   get:
 *     summary: Get API usage statistics
 *     tags: [Developer]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Usage statistics
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', authenticateToken, verifyUser, async (req, res) => {
  try {
    // Get API keys for user
    const apiKeys = await ApiKey.find({ userId: req.currentUser._id });
    
    // Get payment stats
    const paymentStats = await paymentProcessor.getPaymentStats(req.currentUser._id);

    // Calculate total usage across all keys
    const totalUsage = apiKeys.reduce((acc, key) => {
      acc.totalRequests += key.usage.totalRequests;
      acc.totalPayments += key.usage.totalPayments;
      acc.totalAmount += key.usage.totalAmount;
      return acc;
    }, { totalRequests: 0, totalPayments: 0, totalAmount: 0 });

    res.json({
      success: true,
      stats: {
        apiKeys: {
          total: apiKeys.length,
          active: apiKeys.filter(k => k.isActive).length,
          suspended: apiKeys.filter(k => k.status === 'suspended').length
        },
        usage: totalUsage,
        payments: paymentStats
      }
    });
  } catch (error) {
    logger.error('Error fetching developer stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch statistics'
    });
  }
});

/**
 * @swagger
 * /api/developer/docs:
 *   get:
 *     summary: Get API documentation
 *     tags: [Developer]
 *     responses:
 *       200:
 *         description: API documentation
 */
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    documentation: {
      title: 'BSV Micropayments API',
      version: '1.0.0',
      description: 'Real-time BitcoinSV micropayments API for developers',
      baseUrl: `${req.protocol}://${req.get('host')}/api/developer`,
      authentication: {
        type: 'API Key',
        header: 'X-API-Key',
        description: 'Include your API key in the X-API-Key header'
      },
      endpoints: {
        payments: {
          create: {
            method: 'POST',
            path: '/payments',
            description: 'Create a new micropayment',
            required: ['amount', 'description', 'recipientAddress'],
            permissions: ['payments:create']
          },
          status: {
            method: 'GET',
            path: '/payments/{paymentId}',
            description: 'Get payment status',
            permissions: ['payments:read']
          }
        },
        keys: {
          create: {
            method: 'POST',
            path: '/keys',
            description: 'Create a new API key',
            required: ['name'],
            permissions: ['admin:read']
          },
          list: {
            method: 'GET',
            path: '/keys',
            description: 'List all API keys',
            permissions: ['admin:read']
          },
          delete: {
            method: 'DELETE',
            path: '/keys/{keyId}',
            description: 'Delete an API key',
            permissions: ['admin:read']
          }
        }
      },
      examples: {
        createPayment: {
          curl: `curl -X POST ${req.protocol}://${req.get('host')}/api/developer/payments \\
            -H "X-API-Key: your_api_key_here" \\
            -H "Content-Type: application/json" \\
            -d '{
              "amount": 1000,
              "description": "API call payment",
              "recipientAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
            }'`,
          response: {
            success: true,
            payment: {
              paymentId: "pay_1234567890_abc123",
              paymentAddress: "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
              amount: 1000,
              totalAmount: 1100,
              status: "pending"
            }
          }
        }
      }
    }
  });
});

module.exports = router; 