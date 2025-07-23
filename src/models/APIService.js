const mongoose = require('mongoose');

const apiServiceSchema = new mongoose.Schema({
  // Supplier (Business) Information
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  supplierName: {
    type: String,
    required: true,
    trim: true
  },
  supplierEmail: {
    type: String,
    required: true,
    trim: true
  },
  
  // API Service Details
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['data', 'ai', 'payment', 'communication', 'analytics', 'other']
  },
  
  // Pricing Configuration
  pricing: {
    type: {
      type: String,
      enum: ['per_call', 'per_minute', 'per_mb', 'subscription'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      enum: ['satoshis', 'usd_cents'],
      default: 'satoshis'
    },
    freeTier: {
      calls: {
        type: Number,
        default: 0
      },
      amount: {
        type: Number,
        default: 0
      }
    }
  },
  
  // API Configuration
  endpoint: {
    url: {
      type: String,
      required: true,
      trim: true
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE'],
      default: 'GET'
    },
    headers: {
      type: Map,
      of: String,
      default: {}
    },
    timeout: {
      type: Number,
      default: 30000 // 30 seconds
    }
  },
  
  // Authentication
  auth: {
    type: {
      type: String,
      enum: ['none', 'api_key', 'bearer', 'basic', 'oauth2'],
      default: 'none'
    },
    apiKey: {
      type: String,
      trim: true
    },
    bearerToken: {
      type: String,
      trim: true
    },
    username: {
      type: String,
      trim: true
    },
    password: {
      type: String,
      trim: true
    }
  },
  
  // Supplier Payment Configuration
  paymentConfig: {
    stablecoinAddress: {
      type: String,
      required: true,
      trim: true
    },
    stablecoinType: {
      type: String,
      enum: ['USDC', 'USDT', 'DAI'],
      default: 'USDC'
    },
    minimumPayout: {
      type: Number,
      default: 1000 // $10.00 in cents
    },
    payoutSchedule: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    autoPayout: {
      type: Boolean,
      default: true
    }
  },
  
  // Service Status
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'suspended'],
    default: 'draft'
  },
  
  // Usage Statistics
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
    lastCall: {
      type: Date
    },
    lastPayout: {
      type: Date
    }
  },
  
  // Rate Limiting
  rateLimit: {
    requestsPerMinute: {
      type: Number,
      default: 60
    },
    requestsPerHour: {
      type: Number,
      default: 1000
    },
    requestsPerDay: {
      type: Number,
      default: 10000
    }
  },
  
  // Documentation
  documentation: {
    description: String,
    parameters: [{
      name: String,
      type: String,
      required: Boolean,
      description: String
    }],
    examples: [{
      title: String,
      description: String,
      request: String,
      response: String
    }],
    webhookUrl: String
  },
  
  // Metadata
  tags: [String],
  version: {
    type: String,
    default: '1.0.0'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Audit Fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
apiServiceSchema.index({ supplierId: 1, status: 1 });
apiServiceSchema.index({ category: 1, status: 1 });
apiServiceSchema.index({ 'pricing.amount': 1 });
apiServiceSchema.index({ tags: 1 });

// Virtual for formatted pricing
apiServiceSchema.virtual('formattedPricing').get(function() {
  const { pricing } = this;
  if (pricing.currency === 'satoshis') {
    return `${pricing.amount} satoshis per ${pricing.type.replace('_', ' ')}`;
  } else {
    return `$${(pricing.amount / 100).toFixed(2)} per ${pricing.type.replace('_', ' ')}`;
  }
});

// Virtual for revenue in USD
apiServiceSchema.virtual('revenueUSD').get(function() {
  return this.stats.totalRevenue / 100; // Convert cents to dollars
});

// Methods
apiServiceSchema.methods.incrementUsage = function(amount = 0) {
  this.stats.totalCalls += 1;
  if (amount > 0) {
    this.stats.totalRevenue += amount;
  }
  this.stats.lastCall = new Date();
  return this.save();
};

apiServiceSchema.methods.processPayout = function(amount) {
  this.stats.totalPayouts += amount;
  this.stats.lastPayout = new Date();
  return this.save();
};

apiServiceSchema.methods.isEligibleForPayout = function() {
  const pendingAmount = this.stats.totalRevenue - this.stats.totalPayouts;
  return pendingAmount >= this.paymentConfig.minimumPayout;
};

// Static methods
apiServiceSchema.statics.findByCategory = function(category) {
  return this.find({ category, status: 'active' });
};

apiServiceSchema.statics.findBySupplier = function(supplierId) {
  return this.find({ supplierId });
};

apiServiceSchema.statics.findPublic = function() {
  return this.find({ status: 'active', isPublic: true });
};

// Pre-save middleware
apiServiceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('APIService', apiServiceSchema); 