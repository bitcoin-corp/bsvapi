const express = require('express');
const { logger } = require('../utils/logger');
const APIService = require('../models/APIService');
const { authenticateToken, authenticateApiKey, verifyUser } = require('../middleware/auth');
const { apiRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @swagger
 * /api/apis/services:
 *   get:
 *     summary: Get all available API services
 *     tags: [APIs]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
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
 *         description: API services retrieved successfully
 */
router.get('/services', async (req, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;

    let query = { isPublic: true, status: 'active' };
    if (category) {
      query.category = category;
    }

    const services = await APIService.find(query)
      .sort({ 'statistics.totalRequests': -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .select('-authentication.apiKeyValue -authentication.bearerToken -authentication.password');

    const total = await APIService.countDocuments(query);

    res.json({
      services: services.map(service => ({
        id: service._id,
        name: service.name,
        slug: service.slug,
        description: service.description,
        category: service.category,
        pricing: service.pricing,
        status: service.status,
        healthCheck: service.healthCheck,
        statistics: service.statistics,
        metadata: service.metadata
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + services.length
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

    // TODO: Implement actual API proxy call
    // This would involve:
    // 1. Making the actual HTTP request to the external API
    // 2. Handling authentication
    // 3. Processing the response
    // 4. Charging the user
    // 5. Updating statistics

    // For now, return a mock response
    res.json({
      message: 'API proxy call successful',
      service: service.name,
      endpoint: endpoint,
      parameters: queryParams,
      cost: price,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('API proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process API call'
    });
  }
});

module.exports = router; 