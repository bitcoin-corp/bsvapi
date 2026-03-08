const express = require('express');
const { logger } = require('../utils/logger');
const APIService = require('../models/APIService');
const { authenticateToken, authenticateApiKey, verifyUser } = require('../middleware/auth');
const { apiRateLimiter } = require('../middleware/rateLimiter');
const apiProxyService = require('../services/api-proxy-service');

const router = express.Router();

/**
 * @swagger
 * /api/apis/marketplace:
 *   get:
 *     summary: Browse API marketplace
 *     tags: [APIs]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [data, ai, payment, communication, analytics, other]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Search by name or description
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *           description: Minimum price in satoshis
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *           description: Maximum price in satoshis
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [popular, price_low, price_high, newest]
 *           default: popular
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: API marketplace data retrieved successfully
 */
router.get('/marketplace', async (req, res) => {
  try {
    const { 
      category, 
      search, 
      minPrice, 
      maxPrice, 
      sort = 'popular', 
      limit = 20, 
      offset = 0 
    } = req.query;

    // Build query
    let query = { isPublic: true, status: 'active' };
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    if (minPrice || maxPrice) {
      query['pricing.amount'] = {};
      if (minPrice) query['pricing.amount'].$gte = parseInt(minPrice);
      if (maxPrice) query['pricing.amount'].$lte = parseInt(maxPrice);
    }

    // Build sort
    let sortQuery = {};
    switch (sort) {
      case 'popular':
        sortQuery = { 'stats.totalCalls': -1 };
        break;
      case 'price_low':
        sortQuery = { 'pricing.amount': 1 };
        break;
      case 'price_high':
        sortQuery = { 'pricing.amount': -1 };
        break;
      case 'newest':
        sortQuery = { createdAt: -1 };
        break;
      default:
        sortQuery = { 'stats.totalCalls': -1 };
    }

    const services = await APIService.find(query)
      .sort(sortQuery)
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .select('-auth.apiKey -auth.bearerToken -auth.password -auth.username');

    const total = await APIService.countDocuments(query);

    // Get categories for filtering
    const categories = await APIService.distinct('category', { isPublic: true, status: 'active' });

    res.json({
      marketplace: {
        services: services.map(service => ({
          id: service._id,
          name: service.name,
          description: service.description,
          category: service.category,
          pricing: {
            type: service.pricing.type,
            amount: service.pricing.amount,
            currency: service.pricing.currency,
            formattedPrice: service.formattedPricing
          },
          stats: {
            totalCalls: service.stats.totalCalls,
            totalRevenue: service.stats.totalRevenue,
            lastCall: service.stats.lastCall
          },
          tags: service.tags,
          version: service.version,
          createdAt: service.createdAt
        })),
        filters: {
          categories,
          priceRange: {
            min: await APIService.findOne({ isPublic: true, status: 'active' }).sort({ 'pricing.amount': 1 }).select('pricing.amount'),
            max: await APIService.findOne({ isPublic: true, status: 'active' }).sort({ 'pricing.amount': -1 }).select('pricing.amount')
          }
        },
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + services.length
        }
      }
    });

  } catch (error) {
    logger.error('Get API services error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get API services'
    });
  }
});

/**
 * @swagger
 * /api/apis/services/{slug}:
 *   get:
 *     summary: Get API service details
 *     tags: [APIs]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API service details retrieved successfully
 *       404:
 *         description: API service not found
 */
router.get('/services/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const service = await APIService.findBySlug(slug);
    if (!service) {
      return res.status(404).json({
        error: 'Service not found',
        message: 'The specified API service does not exist'
      });
    }

    res.json({
      service: {
        id: service._id,
        name: service.name,
        slug: service.slug,
        description: service.description,
        category: service.category,
        baseUrl: service.baseUrl,
        endpoints: service.endpoints,
        pricing: service.pricing,
        status: service.status,
        healthCheck: service.healthCheck,
        rateLimiting: service.rateLimiting,
        caching: service.caching,
        statistics: service.statistics,
        metadata: service.metadata
      }
    });

  } catch (error) {
    logger.error('Get API service error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get API service details'
    });
  }
});

/**
 * @swagger
 * /api/apis/proxy/{slug}/{endpoint}:
 *   get:
 *     summary: Proxy API call to external service
 *     tags: [APIs]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: endpoint
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: *
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API call successful
 *       400:
 *         description: Invalid request
 *       402:
 *         description: Payment required
 *       404:
 *         description: Service or endpoint not found
 */
router.get('/proxy/:slug/:endpoint', authenticateApiKey, verifyUser, apiRateLimiter, async (req, res) => {
  try {
    const { slug, endpoint } = req.params;
    const queryParams = req.query;

    // Find the API service
    const service = await APIService.findBySlug(slug);
    if (!service) {
      return res.status(404).json({
        error: 'Service not found',
        message: 'The specified API service does not exist'
      });
    }

    // Find the endpoint
    const apiEndpoint = service.getEndpoint(endpoint);
    if (!apiEndpoint) {
      return res.status(404).json({
        error: 'Endpoint not found',
        message: 'The specified endpoint does not exist'
      });
    }

    // Validate parameters
    try {
      service.validateParameters(endpoint, queryParams);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Parameter validation failed',
        message: validationError.message
      });
    }

    // Check if user has sufficient balance
    const price = service.calculatePrice();
    if (req.currentUser.balance < price) {
      return res.status(402).json({
        error: 'Insufficient balance',
        message: `Insufficient balance. Required: ${price} satoshis, Available: ${req.currentUser.balance} satoshis`,
        required: price,
        available: req.currentUser.balance
      });
    }

    // Make the actual API proxy call
    const result = await apiProxyService.proxyAPICall(
      service._id,
      endpoint,
      queryParams,
      req.currentUser._id,
      req.apiKeyId
    );

    res.json(result);

  } catch (error) {
    logger.error('API proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process API call'
    });
  }
});

/**
 * @swagger
 * /api/apis/call:
 *   post:
 *     summary: Make API call with POST request
 *     tags: [APIs]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceId
 *               - endpoint
 *             properties:
 *               serviceId:
 *                 type: string
 *                 description: API service ID
 *               endpoint:
 *                 type: string
 *                 description: API endpoint path
 *               parameters:
 *                 type: object
 *                 description: Request parameters
 *     responses:
 *       200:
 *         description: API call successful
 *       400:
 *         description: Invalid request
 *       402:
 *         description: Payment required
 *       404:
 *         description: Service not found
 */
router.post('/call', authenticateApiKey, verifyUser, apiRateLimiter, async (req, res) => {
  try {
    const { serviceId, endpoint, parameters = {} } = req.body;

    if (!serviceId || !endpoint) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'serviceId and endpoint are required'
      });
    }

    // Find the API service
    const service = await APIService.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        error: 'Service not found',
        message: 'The specified API service does not exist'
      });
    }

    // Make the API proxy call
    const result = await apiProxyService.proxyAPICall(
      serviceId,
      endpoint,
      parameters,
      req.currentUser._id,
      req.apiKeyId
    );

    res.json(result);

  } catch (error) {
    logger.error('API call error:', error);
    
    if (error.code === 'INSUFFICIENT_BALANCE') {
      return res.status(402).json({
        error: 'Insufficient balance',
        message: 'Payment required to access this API',
        data: {
          paymentRequest: error.paymentRequest
        }
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process API call'
    });
  }
});

module.exports = router; 