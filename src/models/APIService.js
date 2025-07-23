const mongoose = require('mongoose');

const apiServiceSchema = new mongoose.Schema({
  // Basic service information
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['data', 'ai', 'finance', 'social', 'utilities', 'other']
  },
  tags: [{
    type: String,
    trim: true
  }],

  // Supplier information
  supplier: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    website: String,
    logo: String
  },

  // API configuration
  apiConfig: {
    baseUrl: {
      type: String,
      required: true
    },
    endpoints: [{
      path: {
        type: String,
        required: true
      },
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
        description: String
      }],
      headers: [{
        name: String,
        value: String,
        description: String
      }],
      authentication: {
        type: {
          type: String,
          enum: ['none', 'api_key', 'bearer', 'basic', 'oauth2'],
          default: 'none'
        },
        key: String,
        value: String,
        header: String
      }
    }],
    rateLimit: {
      requestsPerMinute: {
        type: Number,
        default: 60
      },
      requestsPerHour: {
        type: Number,
        default: 1000
      }
    },
    timeout: {
      type: Number,
      default: 30000 // 30 seconds
    },
    retries: {
      type: Number,
      default: 3
    }
  },

  // Pricing configuration
  pricing: {
    model: {
      type: String,
      enum: ['per_call', 'per_request', 'tiered', 'subscription'],
      default: 'per_call'
    },
    pricePerCall: {
      type: Number,
      required: true,
      min: 0.001 // Minimum $0.001 per call
    },
    currency: {
      type: String,
      default: 'USD'
    },
    tiers: [{
      name: String,
      minCalls: Number,
      maxCalls: Number,
      pricePerCall: Number
    }],
    subscriptionPlans: [{
      name: String,
      price: Number,
      callsPerMonth: Number,
      features: [String]
    }]
  },

  // Payment configuration for supplier payouts
  paymentConfig: {
    paymentMethod: {
      type: String,
      enum: ['stripe', 'paypal', 'bank_transfer'],
      required: true
    },
    preferredCurrency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK']
    },
    // Stripe configuration
    stripeAccountId: String,
    stripePayoutSchedule: {
      type: String,
      enum: ['manual', 'daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    // PayPal configuration
    paypalEmail: String,
    paypalPayoutSchedule: {
      type: String,
      enum: ['manual', 'daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    // Bank transfer configuration
    bankDetails: {
      accountName: String,
      accountNumber: String,
      routingNumber: String,
      bankName: String,
      swiftCode: String,
      iban: String
    },
    // Payout thresholds
    minimumPayout: {
      type: Number,
      default: 50.00 // $50 minimum payout
    },
    autoPayout: {
      type: Boolean,
      default: true
    }
  },

  // Usage statistics
  stats: {
    totalCalls: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    totalPayouts: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 100
    },
    lastCallAt: Date,
    lastPayoutAt: Date
  },

  // Service status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'maintenance'],
    default: 'active'
  },

  // Documentation
  documentation: {
    overview: String,
    quickStart: String,
    examples: [{
      title: String,
      description: String,
      code: String,
      language: String
    }],
    apiReference: String,
    supportEmail: String,
    supportUrl: String
  },

  // Metadata
  metadata: {
    featured: {
      type: Boolean,
      default: false
    },
    verified: {
      type: Boolean,
      default: false
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
apiServiceSchema.index({ 'supplier.id': 1 });
apiServiceSchema.index({ category: 1 });
apiServiceSchema.index({ status: 1 });
apiServiceSchema.index({ 'metadata.featured': 1 });
apiServiceSchema.index({ 'stats.totalCalls': -1 });
apiServiceSchema.index({ 'pricing.pricePerCall': 1 });

// Virtual for current balance (revenue - payouts)
apiServiceSchema.virtual('currentBalance').get(function() {
  return this.stats.totalRevenue - this.stats.totalPayouts;
});

// Virtual for payout eligibility
apiServiceSchema.virtual('isEligibleForPayout').get(function() {
  return this.currentBalance >= this.paymentConfig.minimumPayout;
});

// Methods
apiServiceSchema.methods.incrementUsage = async function(callCost = 0) {
  this.stats.totalCalls += 1;
  this.stats.totalRevenue += callCost;
  this.stats.lastCallAt = new Date();
  await this.save();
};

apiServiceSchema.methods.processPayout = async function(amount) {
  this.stats.totalPayouts += amount;
  this.stats.lastPayoutAt = new Date();
  await this.save();
};

apiServiceSchema.methods.updateResponseTime = async function(responseTime) {
  // Update average response time
  const totalCalls = this.stats.totalCalls;
  const currentAvg = this.stats.averageResponseTime;
  
  this.stats.averageResponseTime = ((currentAvg * (totalCalls - 1)) + responseTime) / totalCalls;
  await this.save();
};

apiServiceSchema.methods.updateSuccessRate = async function(success) {
  const totalCalls = this.stats.totalCalls;
  const currentSuccessRate = this.stats.successRate;
  
  if (success) {
    this.stats.successRate = ((currentSuccessRate * (totalCalls - 1)) + 100) / totalCalls;
  } else {
    this.stats.successRate = (currentSuccessRate * (totalCalls - 1)) / totalCalls;
  }
  
  await this.save();
};

// Static methods
apiServiceSchema.statics.findByCategory = function(category) {
  return this.find({ category, status: 'active' });
};

apiServiceSchema.statics.findFeatured = function() {
  return this.find({ 'metadata.featured': true, status: 'active' });
};

apiServiceSchema.statics.findBySupplier = function(supplierId) {
  return this.find({ 'supplier.id': supplierId });
};

apiServiceSchema.statics.findEligibleForPayout = function() {
  return this.find({
    status: 'active',
    'paymentConfig.autoPayout': true
  });
};

module.exports = mongoose.model('APIService', apiServiceSchema); 