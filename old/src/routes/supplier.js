const express = require('express');
const Joi = require('joi');
const { logger } = require('../utils/logger');
const APIService = require('../models/APIService');
const User = require('../models/User');
const { authenticateToken, verifyUser } = require('../middleware/auth');
const { supplierRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Validation schemas
const createAPIServiceSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().min(10).max(1000).required(),
  category: Joi.string().valid('data', 'ai', 'payment', 'communication', 'analytics', 'other').required(),
  
  pricing: Joi.object({
    type: Joi.string().valid('per_call', 'per_minute', 'per_mb', 'subscription').required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().valid('satoshis', 'usd_cents').default('satoshis'),
    freeTier: Joi.object({
      calls: Joi.number().min(0).default(0),
      amount: Joi.number().min(0).default(0)
    }).optional()
  }).required(),
  
  endpoint: Joi.object({
    url: Joi.string().uri().required(),
    method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE').default('GET'),
    headers: Joi.object().optional(),
    timeout: Joi.number().min(1000).max(120000).default(30000)
  }).required(),
  
  auth: Joi.object({
    type: Joi.string().valid('none', 'api_key', 'bearer', 'basic', 'oauth2').default('none'),
    apiKey: Joi.string().when('type', {
      is: 'api_key',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    bearerToken: Joi.string().when('type', {
      is: 'bearer',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    username: Joi.string().when('type', {
      is: 'basic',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    password: Joi.string().when('type', {
      is: 'basic',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  }).required(),
  
  paymentConfig: Joi.object({
    stablecoinAddress: Joi.string().required(),
    stablecoinType: Joi.string().valid('USDC', 'USDT', 'DAI').default('USDC'),
    minimumPayout: Joi.number().min(100).default(1000), // $1.00 minimum
    payoutSchedule: Joi.string().valid('daily', 'weekly', 'monthly').default('weekly'),
    autoPayout: Joi.boolean().default(true)
  }).required(),
  
  rateLimit: Joi.object({
    requestsPerMinute: Joi.number().min(1).max(1000).default(60),
    requestsPerHour: Joi.number().min(1).max(10000).default(1000),
    requestsPerDay: Joi.number().min(1).max(100000).default(10000)
  }).optional(),
  
  documentation: Joi.object({
    description: Joi.string().optional(),
    parameters: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      required: Joi.boolean().required(),
      description: Joi.string().required()
    })).optional(),
    examples: Joi.array().items(Joi.object({
      title: Joi.string().required(),
      description: Joi.string().required(),
      request: Joi.string().required(),
      response: Joi.string().required()
    })).optional(),
    webhookUrl: Joi.string().uri().optional()
  }).optional(),
  
  tags: Joi.array().items(Joi.string()).optional(),
  isPublic: Joi.boolean().default(true)
});

/**
 * @swagger
 * /api/supplier/services:
 *   post:
 *     summary: Register a new API service as a supplier
 *     tags: [Supplier]
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
 *               - description
 *               - category
 *               - pricing
 *               - endpoint
 *               - auth
 *               - paymentConfig
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               category:
 *                 type: string
 *                 enum: [data, ai, payment, communication, analytics, other]
 *               pricing:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [per_call, per_minute, per_mb, subscription]
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                   currency:
 *                     type: string
 *                     enum: [satoshis, usd_cents]
 *     responses:
 *       201:
 *         description: API service registered successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/services', authenticateToken, verifyUser, supplierRateLimiter, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createAPIServiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const {
      name,
      description,
      category,
      pricing,
      endpoint,
      auth,
      paymentConfig,
      rateLimit,
      documentation,
      tags,
      isPublic
    } = value;

    // Get supplier details
    const supplier = await User.findById(req.currentUser._id);
    if (!supplier) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Supplier not found'
      });
    }

    // Create API service
    const apiService = new APIService({
      supplierId: req.currentUser._id,
      supplierName: supplier.name || supplier.email,
      supplierEmail: supplier.email,
      name,
      description,
      category,
      pricing,
      endpoint,
      auth,
      paymentConfig,
      rateLimit: rateLimit || {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      },
      documentation,
      tags: tags || [],
      isPublic,
      status: 'draft' // Requires approval
    });

    await apiService.save();

    logger.info(`API service registered by supplier ${req.currentUser._id}: ${name}`);

    res.status(201).json({
      success: true,
      apiService: {
        id: apiService._id,
        name: apiService.name,
        description: apiService.description,
        category: apiService.category,
        pricing: apiService.pricing,
        status: apiService.status,
        createdAt: apiService.createdAt
      },
      message: 'API service registered successfully. Awaiting approval.'
    });
  } catch (error) {
    logger.error('Error registering API service:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to register API service'
    });
  }
});

/**
 * @swagger
 * /api/supplier/services:
 *   get:
 *     summary: Get all API services for the current supplier
 *     tags: [Supplier]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of API services
 *       401:
 *         description: Unauthorized
 */
router.get('/services', authenticateToken, verifyUser, async (req, res) => {
  try {
    const apiServices = await APIService.find({ supplierId: req.currentUser._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      apiServices: apiServices.map(service => ({
        id: service._id,
        name: service.name,
        description: service.description,
        category: service.category,
        pricing: service.pricing,
        status: service.status,
        stats: service.stats,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt
      }))
    });
  } catch (error) {
    logger.error('Error fetching supplier services:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch API services'
    });
  }
});

/**
 * @swagger
 * /api/supplier/services/{serviceId}:
 *   get:
 *     summary: Get specific API service details
 *     tags: [Supplier]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API service details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Service not found
 */
router.get('/services/:serviceId', authenticateToken, verifyUser, async (req, res) => {
  try {
    const apiService = await APIService.findOne({
      _id: req.params.serviceId,
      supplierId: req.currentUser._id
    });

    if (!apiService) {
      return res.status(404).json({
        error: 'Not found',
        message: 'API service not found'
      });
    }

    res.json({
      success: true,
      apiService: {
        id: apiService._id,
        name: apiService.name,
        description: apiService.description,
        category: apiService.category,
        pricing: apiService.pricing,
        endpoint: apiService.endpoint,
        auth: apiService.auth,
        paymentConfig: apiService.paymentConfig,
        status: apiService.status,
        stats: apiService.stats,
        rateLimit: apiService.rateLimit,
        documentation: apiService.documentation,
        tags: apiService.tags,
        isPublic: apiService.isPublic,
        createdAt: apiService.createdAt,
        updatedAt: apiService.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching API service:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch API service'
    });
  }
});

/**
 * @swagger
 * /api/supplier/services/{serviceId}:
 *   put:
 *     summary: Update API service
 *     tags: [Supplier]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API service updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Service not found
 */
router.put('/services/:serviceId', authenticateToken, verifyUser, async (req, res) => {
  try {
    const apiService = await APIService.findOne({
      _id: req.params.serviceId,
      supplierId: req.currentUser._id
    });

    if (!apiService) {
      return res.status(404).json({
        error: 'Not found',
        message: 'API service not found'
      });
    }

    // Only allow updates if service is in draft or paused status
    if (apiService.status === 'active') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Cannot update active service. Please pause it first.'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'name', 'description', 'pricing', 'endpoint', 'auth', 
      'rateLimit', 'documentation', 'tags', 'isPublic'
    ];

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        apiService[field] = req.body[field];
      }
    }

    // Reset status to draft for re-approval
    apiService.status = 'draft';
    apiService.approvedAt = null;
    apiService.approvedBy = null;

    await apiService.save();

    logger.info(`API service updated by supplier ${req.currentUser._id}: ${apiService.name}`);

    res.json({
      success: true,
      apiService: {
        id: apiService._id,
        name: apiService.name,
        status: apiService.status,
        updatedAt: apiService.updatedAt
      },
      message: 'API service updated successfully. Awaiting re-approval.'
    });
  } catch (error) {
    logger.error('Error updating API service:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update API service'
    });
  }
});

/**
 * @swagger
 * /api/supplier/services/{serviceId}/pause:
 *   post:
 *     summary: Pause API service
 *     tags: [Supplier]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API service paused successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Service not found
 */
router.post('/services/:serviceId/pause', authenticateToken, verifyUser, async (req, res) => {
  try {
    const apiService = await APIService.findOne({
      _id: req.params.serviceId,
      supplierId: req.currentUser._id
    });

    if (!apiService) {
      return res.status(404).json({
        error: 'Not found',
        message: 'API service not found'
      });
    }

    if (apiService.status !== 'active') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Service is not active'
      });
    }

    apiService.status = 'paused';
    await apiService.save();

    logger.info(`API service paused by supplier ${req.currentUser._id}: ${apiService.name}`);

    res.json({
      success: true,
      message: 'API service paused successfully'
    });
  } catch (error) {
    logger.error('Error pausing API service:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to pause API service'
    });
  }
});

/**
 * @swagger
 * /api/supplier/services/{serviceId}/activate:
 *   post:
 *     summary: Activate API service
 *     tags: [Supplier]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API service activated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Service not found
 */
router.post('/services/:serviceId/activate', authenticateToken, verifyUser, async (req, res) => {
  try {
    const apiService = await APIService.findOne({
      _id: req.params.serviceId,
      supplierId: req.currentUser._id
    });

    if (!apiService) {
      return res.status(404).json({
        error: 'Not found',
        message: 'API service not found'
      });
    }

    if (apiService.status !== 'paused') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Service is not paused'
      });
    }

    apiService.status = 'active';
    await apiService.save();

    logger.info(`API service activated by supplier ${req.currentUser._id}: ${apiService.name}`);

    res.json({
      success: true,
      message: 'API service activated successfully'
    });
  } catch (error) {
    logger.error('Error activating API service:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to activate API service'
    });
  }
});

/**
 * @swagger
 * /api/supplier/stats:
 *   get:
 *     summary: Get supplier statistics
 *     tags: [Supplier]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Supplier statistics
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', authenticateToken, verifyUser, async (req, res) => {
  try {
    const apiServices = await APIService.find({ supplierId: req.currentUser._id });
    
    const totalServices = apiServices.length;
    const activeServices = apiServices.filter(s => s.status === 'active').length;
    const totalCalls = apiServices.reduce((sum, s) => sum + s.stats.totalCalls, 0);
    const totalRevenue = apiServices.reduce((sum, s) => sum + s.stats.totalRevenue, 0);
    const totalPayouts = apiServices.reduce((sum, s) => sum + s.stats.totalPayouts, 0);
    const pendingPayouts = totalRevenue - totalPayouts;

    res.json({
      success: true,
      stats: {
        services: {
          total: totalServices,
          active: activeServices,
          paused: totalServices - activeServices
        },
        usage: {
          totalCalls,
          totalRevenue: totalRevenue / 100, // Convert cents to dollars
          totalPayouts: totalPayouts / 100,
          pendingPayouts: pendingPayouts / 100
        },
        topServices: apiServices
          .sort((a, b) => b.stats.totalCalls - a.stats.totalCalls)
          .slice(0, 5)
          .map(s => ({
            id: s._id,
            name: s.name,
            calls: s.stats.totalCalls,
            revenue: s.stats.totalRevenue / 100
          }))
      }
    });
  } catch (error) {
    logger.error('Error fetching supplier stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch statistics'
    });
  }
});

module.exports = router; 