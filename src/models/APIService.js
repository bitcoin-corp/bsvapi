const mongoose = require('mongoose');

const apiServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: ['finance', 'weather', 'news', 'social', 'ecommerce', 'transport', 'health', 'education', 'entertainment', 'other']
  },
  baseUrl: {
    type: String,
    required: true,
    trim: true
  },
  endpoints: [{
    name: String,
    path: String,
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      default: 'GET'
    },
    description: String,
    parameters: [{
      name: String,
      type: String,
      required: Boolean,
      description: String,
      defaultValue: String
    }],
    responseSchema: mongoose.Schema.Types.Mixed,
    rateLimit: {
      requests: Number,
      window: Number // in seconds
    }
  }],
  authentication: {
    type: {
      type: String,
      enum: ['none', 'api_key', 'bearer', 'basic', 'oauth2'],
      default: 'none'
    },
    apiKeyHeader: String,
    apiKeyValue: String,
    bearerToken: String,
    username: String,
    password: String,
    oauth2Config: {
      clientId: String,
      clientSecret: String,
      tokenUrl: String,
      scope: String
    }
  },
  pricing: {
    basePrice: {
      type: Number,
      required: true,
      min: 0
    },
    pricePerRequest: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'satoshis'
    },
    freeTier: {
      requests: {
        type: Number,
        default: 0
      },
      period: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'daily'
      }
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'deprecated'],
    default: 'active'
  },
  healthCheck: {
    endpoint: String,
    expectedStatus: Number,
    lastCheck: Date,
    isHealthy: {
      type: Boolean,
      default: true
    },
    responseTime: Number,
    uptime: {
      type: Number,
      default: 100
    }
  },
  rateLimiting: {
    enabled: {
      type: Boolean,
      default: true
    },
    requestsPerMinute: {
      type: Number,
      default: 60
    },
    burstLimit: {
      type: Number,
      default: 100
    }
  },
  caching: {
    enabled: {
      type: Boolean,
      default: true
    },
    ttl: {
      type: Number,
      default: 300 // 5 minutes
    },
    maxSize: {
      type: Number,
      default: 1000
    }
  },
  metadata: {
    version: String,
    documentation: String,
    website: String,
    support: String,
    tags: [String],
    icon: String,
    color: String
  },
  statistics: {
    totalRequests: {
      type: Number,
      default: 0
    },
    successfulRequests: {
      type: Number,
      default: 0
    },
    failedRequests: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    }
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
apiServiceSchema.index({ slug: 1 });
apiServiceSchema.index({ category: 1 });
apiServiceSchema.index({ status: 1 });
apiServiceSchema.index({ isPublic: 1 });
apiServiceSchema.index({ 'statistics.totalRequests': -1 });
apiServiceSchema.index({ createdAt: -1 });

// Virtual for success rate
apiServiceSchema.virtual('successRate').get(function() {
  if (this.statistics.totalRequests === 0) return 0;
  return (this.statistics.successfulRequests / this.statistics.totalRequests) * 100;
});

// Virtual for availability
apiServiceSchema.virtual('availability').get(function() {
  return this.healthCheck.isHealthy ? 'online' : 'offline';
});

// Instance methods
apiServiceSchema.methods = {
  // Update statistics
  async updateStatistics(responseTime, success = true) {
    this.statistics.totalRequests += 1;
    this.statistics.averageResponseTime = 
      (this.statistics.averageResponseTime * (this.statistics.totalRequests - 1) + responseTime) / this.statistics.totalRequests;
    
    if (success) {
      this.statistics.successfulRequests += 1;
    } else {
      this.statistics.failedRequests += 1;
    }
    
    return await this.save();
  },

  // Update health check
  async updateHealthCheck(isHealthy, responseTime) {
    this.healthCheck.isHealthy = isHealthy;
    this.healthCheck.responseTime = responseTime;
    this.healthCheck.lastCheck = new Date();
    
    return await this.save();
  },

  // Calculate price for request
  calculatePrice(requestCount = 1) {
    return this.pricing.basePrice + (this.pricing.pricePerRequest * requestCount);
  },

  // Check if user has free tier available
  hasFreeTierAvailable(userUsage) {
    if (this.pricing.freeTier.requests === 0) return false;
    
    const period = this.pricing.freeTier.period;
    const now = new Date();
    let startOfPeriod;
    
    switch (period) {
      case 'daily':
        startOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek;
        startOfPeriod = new Date(now.getFullYear(), now.getMonth(), diff);
        break;
      case 'monthly':
        startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    
    const periodUsage = userUsage.filter(usage => 
      new Date(usage.timestamp) >= startOfPeriod
    ).reduce((sum, usage) => sum + usage.requests, 0);
    
    return periodUsage < this.pricing.freeTier.requests;
  },

  // Get endpoint by name
  getEndpoint(name) {
    return this.endpoints.find(endpoint => endpoint.name === name);
  },

  // Validate endpoint parameters
  validateParameters(endpointName, params) {
    const endpoint = this.getEndpoint(endpointName);
    if (!endpoint) throw new Error('Endpoint not found');
    
    const requiredParams = endpoint.parameters.filter(p => p.required);
    const missingParams = requiredParams.filter(p => !params[p.name]);
    
    if (missingParams.length > 0) {
      throw new Error(`Missing required parameters: ${missingParams.map(p => p.name).join(', ')}`);
    }
    
    return true;
  }
};

// Static methods
apiServiceSchema.statics = {
  // Find by slug
  async findBySlug(slug) {
    return this.findOne({ slug, isPublic: true, status: 'active' });
  },

  // Find by category
  async findByCategory(category) {
    return this.find({ category, isPublic: true, status: 'active' });
  },

  // Get popular services
  async getPopular(limit = 10) {
    return this.find({ isPublic: true, status: 'active' })
      .sort({ 'statistics.totalRequests': -1 })
      .limit(limit);
  },

  // Get trending services
  async getTrending(limit = 10) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.find({ 
      isPublic: true, 
      status: 'active',
      updatedAt: { $gte: oneWeekAgo }
    })
    .sort({ 'statistics.totalRequests': -1 })
    .limit(limit);
  }
};

module.exports = mongoose.model('APIService', apiServiceSchema); 