const axios = require('axios');
const { logger } = require('../utils/logger');
const APIService = require('../models/APIService');
const Payment = require('../models/Payment');
const User = require('../models/User');
const paymentProcessor = require('./payment-processor');
const exchangeService = require('./exchange-service');

class APIProxyService {
  constructor() {
    this.defaultTimeout = 30000; // 30 seconds
    this.maxRetries = 3;
  }

  /**
   * Proxy API call to external service
   */
  async proxyAPICall(serviceId, endpoint, parameters, userId, apiKeyId = null) {
    try {
      // Get API service
      const apiService = await APIService.findById(serviceId);
      if (!apiService || apiService.status !== 'active') {
        throw new Error('API service not found or inactive');
      }

      // Calculate cost
      const cost = this.calculateCost(apiService, parameters);
      
      // Check user balance
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.balance < cost) {
        // Create payment request
        const paymentRequest = await this.createPaymentRequest(userId, cost, apiService, endpoint);
        throw new Error('Insufficient balance', { 
          code: 'INSUFFICIENT_BALANCE',
          paymentRequest 
        });
      }

      // Make the actual API call
      const apiResponse = await this.makeExternalAPICall(apiService, endpoint, parameters);

      // Process payment
      await this.processPayment(userId, apiService._id, cost, endpoint);

      // Update API service statistics
      await apiService.incrementUsage(cost);

      // Convert BSV payment to stablecoin for supplier
      await this.processSupplierPayment(apiService._id, cost);

      return {
        success: true,
        data: apiResponse.data,
        payment: {
          amount: cost,
          currency: 'satoshis',
          status: 'confirmed'
        },
        metadata: {
          serviceId: apiService._id,
          serviceName: apiService.name,
          endpoint: endpoint,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error(`API proxy error for service ${serviceId}:`, error);
      
      if (error.code === 'INSUFFICIENT_BALANCE') {
        throw error;
      }
      
      throw new Error(`API call failed: ${error.message}`);
    }
  }

  /**
   * Calculate cost for API call
   */
  calculateCost(apiService, parameters) {
    const { pricing } = apiService;
    
    switch (pricing.type) {
      case 'per_call':
        return pricing.amount;
      
      case 'per_minute':
        // Calculate based on estimated processing time
        return pricing.amount;
      
      case 'per_mb':
        // Estimate data transfer size
        const estimatedSize = this.estimateDataSize(parameters);
        return Math.ceil(estimatedSize / 1024 / 1024) * pricing.amount;
      
      case 'subscription':
        // Check if user has active subscription
        return 0; // Already paid via subscription
      
      default:
        return pricing.amount;
    }
  }

  /**
   * Estimate data size for parameters
   */
  estimateDataSize(parameters) {
    return JSON.stringify(parameters).length;
  }

  /**
   * Create payment request for insufficient balance
   */
  async createPaymentRequest(userId, amount, apiService, endpoint) {
    const paymentRequest = await paymentProcessor.processPaymentRequest({
      userId,
      amount,
      description: `API call to ${apiService.name} - ${endpoint}`,
      type: 'api_call',
      recipientAddress: process.env.BSV_SERVICE_ADDRESS,
      metadata: {
        apiServiceId: apiService._id,
        endpoint: endpoint,
        serviceName: apiService.name
      }
    });

    return paymentRequest;
  }

  /**
   * Make actual HTTP request to external API
   */
  async makeExternalAPICall(apiService, endpoint, parameters) {
    const { endpoint: config, auth } = apiService;
    
    // Build request URL
    const url = this.buildRequestURL(config.url, endpoint, parameters);
    
    // Build request headers
    const headers = this.buildRequestHeaders(config.headers, auth, parameters);
    
    // Build request body for POST/PUT requests
    const body = this.buildRequestBody(config.method, parameters);
    
    // Make the request
    const response = await this.makeHTTPRequest({
      method: config.method,
      url,
      headers,
      data: body,
      timeout: config.timeout || this.defaultTimeout
    });

    return response;
  }

  /**
   * Build request URL
   */
  buildRequestURL(baseUrl, endpoint, parameters) {
    let url = `${baseUrl}${endpoint}`;
    
    // Add query parameters for GET requests
    if (parameters && Object.keys(parameters).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(parameters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      url += `?${queryParams.toString()}`;
    }
    
    return url;
  }

  /**
   * Build request headers
   */
  buildRequestHeaders(baseHeaders, auth, parameters) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'BSVAPI-Proxy/1.0',
      ...baseHeaders
    };

    // Add authentication headers
    switch (auth.type) {
      case 'api_key':
        if (auth.apiKey) {
          headers['X-API-Key'] = auth.apiKey;
        }
        break;
      
      case 'bearer':
        if (auth.bearerToken) {
          headers['Authorization'] = `Bearer ${auth.bearerToken}`;
        }
        break;
      
      case 'basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
    }

    return headers;
  }

  /**
   * Build request body
   */
  buildRequestBody(method, parameters) {
    if (method === 'GET' || method === 'DELETE') {
      return undefined;
    }
    
    return parameters;
  }

  /**
   * Make HTTP request with retry logic
   */
  async makeHTTPRequest(requestConfig) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios(requestConfig);
        return response;
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          throw error;
        }
        
        // Retry on server errors (5xx) or network errors
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          logger.warn(`API request failed, retrying (${attempt}/${this.maxRetries}):`, error.message);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Process payment for API call
   */
  async processPayment(userId, serviceId, amount, endpoint) {
    try {
      // Deduct from user balance
      const user = await User.findById(userId);
      user.balance -= amount;
      await user.save();

      // Create payment record
      const payment = new Payment({
        paymentId: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId,
        type: 'api_call',
        amount: amount,
        currency: 'satoshis',
        status: 'confirmed',
        recipientAddress: process.env.BSV_SERVICE_ADDRESS,
        confirmedAt: new Date(),
        metadata: {
          description: `API call payment`,
          apiServiceId: serviceId,
          endpoint: endpoint
        }
      });

      await payment.save();

      logger.info(`API payment processed: ${amount} satoshis for user ${userId}`);

    } catch (error) {
      logger.error('Error processing API payment:', error);
      throw error;
    }
  }

  /**
   * Process supplier payment (convert BSV to stablecoin)
   */
  async processSupplierPayment(serviceId, amount) {
    try {
      // Find the payment record
      const payment = await Payment.findOne({
        'metadata.apiServiceId': serviceId,
        type: 'api_call',
        status: 'confirmed'
      }).sort({ createdAt: -1 });

      if (payment) {
        await exchangeService.processPaymentForSupplier(payment.paymentId);
      }
    } catch (error) {
      logger.error('Error processing supplier payment:', error);
      // Don't throw - this shouldn't fail the API call
    }
  }

  /**
   * Validate API service configuration
   */
  validateServiceConfig(apiService) {
    const errors = [];

    if (!apiService.endpoint.url) {
      errors.push('Endpoint URL is required');
    }

    if (!apiService.pricing.amount || apiService.pricing.amount <= 0) {
      errors.push('Valid pricing amount is required');
    }

    if (apiService.auth.type === 'api_key' && !apiService.auth.apiKey) {
      errors.push('API key is required for api_key authentication');
    }

    if (apiService.auth.type === 'bearer' && !apiService.auth.bearerToken) {
      errors.push('Bearer token is required for bearer authentication');
    }

    if (apiService.auth.type === 'basic' && (!apiService.auth.username || !apiService.auth.password)) {
      errors.push('Username and password are required for basic authentication');
    }

    return errors;
  }

  /**
   * Test API service connectivity
   */
  async testServiceConnectivity(apiService) {
    try {
      const testResponse = await this.makeHTTPRequest({
        method: 'GET',
        url: apiService.endpoint.url,
        headers: this.buildRequestHeaders(apiService.endpoint.headers, apiService.auth, {}),
        timeout: 10000 // 10 seconds for connectivity test
      });

      return {
        success: true,
        statusCode: testResponse.status,
        responseTime: testResponse.responseTime
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Get API service statistics
   */
  async getServiceStats(serviceId, timeRange = '24h') {
    try {
      const apiService = await APIService.findById(serviceId);
      if (!apiService) {
        throw new Error('API service not found');
      }

      // Get payment statistics
      const payments = await Payment.find({
        'metadata.apiServiceId': serviceId,
        type: 'api_call',
        status: 'confirmed',
        createdAt: { $gte: this.getTimeRangeDate(timeRange) }
      });

      const totalCalls = payments.length;
      const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const averageResponseTime = apiService.stats.averageResponseTime || 0;

      return {
        serviceId: serviceId,
        serviceName: apiService.name,
        timeRange: timeRange,
        statistics: {
          totalCalls,
          totalRevenue,
          averageResponseTime,
          successRate: apiService.stats.successRate || 0,
          lastCall: apiService.stats.lastCall
        }
      };
    } catch (error) {
      logger.error('Error getting service stats:', error);
      throw error;
    }
  }

  /**
   * Get time range date
   */
  getTimeRangeDate(timeRange) {
    const now = new Date();
    
    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }
}

module.exports = new APIProxyService(); 