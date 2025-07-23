const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  permissions: [{
    type: String,
    enum: ['payments:create', 'payments:read', 'payments:update', 'channels:create', 'channels:read', 'admin:read']
  }],
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
  usage: {
    totalRequests: {
      type: Number,
      default: 0
    },
    totalPayments: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date
    }
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'expired'],
    default: 'active'
  },
  expiresAt: {
    type: Date
  },
  ipWhitelist: [{
    type: String,
    trim: true
  }],
  webhookUrl: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for performance
apiKeySchema.index({ userId: 1, status: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if key is expired
apiKeySchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for checking if key is active
apiKeySchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.isExpired;
});

// Methods
apiKeySchema.methods.incrementUsage = function(amount = 0) {
  this.usage.totalRequests += 1;
  if (amount > 0) {
    this.usage.totalPayments += 1;
    this.usage.totalAmount += amount;
  }
  this.usage.lastUsed = new Date();
  return this.save();
};

apiKeySchema.methods.checkRateLimit = function() {
  // This would be implemented with Redis for real-time rate limiting
  // For now, we'll just return true
  return true;
};

apiKeySchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

// Static methods
apiKeySchema.statics.generateKey = function() {
  const crypto = require('crypto');
  return 'bsv_' + crypto.randomBytes(32).toString('hex');
};

apiKeySchema.statics.findByKey = function(key) {
  return this.findOne({ key, status: 'active' });
};

// Pre-save middleware
apiKeySchema.pre('save', function(next) {
  // Auto-expire if past expiration date
  if (this.expiresAt && this.expiresAt < new Date()) {
    this.status = 'expired';
  }
  next();
});

module.exports = mongoose.model('ApiKey', apiKeySchema); 