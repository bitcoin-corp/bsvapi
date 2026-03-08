const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  apiServiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'APIService'
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'api_call', 'refund', 'service_fee'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'satoshis'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  bsvTransaction: {
    txid: String,
    hex: String,
    confirmations: {
      type: Number,
      default: 0
    },
    blockHeight: Number,
    blockTime: Date,
    fee: Number,
    inputs: [{
      address: String,
      amount: Number,
      txid: String,
      vout: Number
    }],
    outputs: [{
      address: String,
      amount: Number,
      script: String
    }]
  },
  micropaymentChannel: {
    channelId: String,
    previousBalance: Number,
    newBalance: Number
  },
  metadata: {
    description: String,
    apiEndpoint: String,
    requestId: String,
    callbackUrl: String,
    ipAddress: String,
    userAgent: String,
    referrer: String
  },
  fees: {
    minerFee: {
      type: Number,
      default: 0
    },
    serviceFee: {
      type: Number,
      default: 0
    },
    totalFees: {
      type: Number,
      default: 0
    }
  },
  processing: {
    startedAt: Date,
    completedAt: Date,
    processingTime: Number, // in milliseconds
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    lastAttempt: Date,
    errorMessage: String,
    errorCode: String
  },
  refund: {
    originalPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    reason: String,
    refundedAt: Date,
    refundAmount: Number
  },
  webhook: {
    sent: {
      type: Boolean,
      default: false
    },
    attempts: {
      type: Number,
      default: 0
    },
    lastAttempt: Date,
    response: {
      statusCode: Number,
      body: String
    }
  }
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ apiServiceId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ 'bsvTransaction.txid': 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ 'processing.startedAt': 1 });

// Compound indexes
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, 'processing.attempts': 1 });

// Virtual for total amount including fees
paymentSchema.virtual('totalAmount').get(function() {
  return this.amount + this.fees.totalFees;
});

// Virtual for is refundable
paymentSchema.virtual('isRefundable').get(function() {
  return this.status === 'completed' && this.type !== 'refund' && !this.refund.originalPaymentId;
});

// Virtual for processing duration
paymentSchema.virtual('processingDuration').get(function() {
  if (!this.processing.startedAt) return null;
  const endTime = this.processing.completedAt || new Date();
  return endTime - this.processing.startedAt;
});

// Instance methods
paymentSchema.methods = {
  // Start processing
  async startProcessing() {
    this.processing.startedAt = new Date();
    this.status = 'processing';
    this.processing.attempts += 1;
    this.processing.lastAttempt = new Date();
    
    return await this.save();
  },

  // Complete processing
  async completeProcessing() {
    this.status = 'completed';
    this.processing.completedAt = new Date();
    this.processing.processingTime = this.processingDuration;
    
    return await this.save();
  },

  // Fail processing
  async failProcessing(errorMessage, errorCode = null) {
    this.status = 'failed';
    this.processing.completedAt = new Date();
    this.processing.processingTime = this.processingDuration;
    this.processing.errorMessage = errorMessage;
    this.processing.errorCode = errorCode;
    
    return await this.save();
  },

  // Retry processing
  async retryProcessing() {
    if (this.processing.attempts >= this.processing.maxAttempts) {
      throw new Error('Maximum retry attempts reached');
    }
    
    this.status = 'pending';
    this.processing.startedAt = null;
    this.processing.completedAt = null;
    this.processing.processingTime = null;
    this.processing.errorMessage = null;
    this.processing.errorCode = null;
    
    return await this.save();
  },

  // Update BSV transaction
  async updateBSVTransaction(txData) {
    this.bsvTransaction = { ...this.bsvTransaction, ...txData };
    
    if (txData.confirmations > 0) {
      this.status = 'completed';
      this.processing.completedAt = new Date();
    }
    
    return await this.save();
  },

  // Create refund
  async createRefund(reason, refundAmount = null) {
    if (!this.isRefundable) {
      throw new Error('Payment is not refundable');
    }
    
    const refund = new mongoose.model('Payment')({
      paymentId: this.generatePaymentId(),
      userId: this.userId,
      type: 'refund',
      amount: refundAmount || this.amount,
      currency: this.currency,
      status: 'pending',
      metadata: {
        description: `Refund for payment ${this.paymentId}`,
        reason: reason
      },
      refund: {
        originalPaymentId: this._id,
        reason: reason,
        refundAmount: refundAmount || this.amount
      }
    });
    
    return await refund.save();
  },

  // Generate payment ID
  generatePaymentId() {
    return 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  // Calculate fees
  calculateFees() {
    const minerFee = this.fees.minerFee || 0;
    const serviceFee = this.fees.serviceFee || 0;
    this.fees.totalFees = minerFee + serviceFee;
    return this.fees.totalFees;
  },

  // Send webhook
  async sendWebhook() {
    if (!this.metadata.callbackUrl) return;
    
    try {
      const response = await fetch(this.metadata.callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-ID': this.paymentId,
          'X-Signature': this.generateWebhookSignature()
        },
        body: JSON.stringify({
          paymentId: this.paymentId,
          status: this.status,
          amount: this.amount,
          currency: this.currency,
          timestamp: new Date().toISOString()
        })
      });
      
      this.webhook.sent = true;
      this.webhook.attempts += 1;
      this.webhook.lastAttempt = new Date();
      this.webhook.response = {
        statusCode: response.status,
        body: await response.text()
      };
      
      await this.save();
    } catch (error) {
      this.webhook.attempts += 1;
      this.webhook.lastAttempt = new Date();
      this.webhook.response = {
        statusCode: 0,
        body: error.message
      };
      
      await this.save();
    }
  },

  // Generate webhook signature
  generateWebhookSignature() {
    const crypto = require('crypto');
    const payload = JSON.stringify({
      paymentId: this.paymentId,
      status: this.status,
      amount: this.amount,
      timestamp: new Date().toISOString()
    });
    
    return crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET || 'default-secret')
      .update(payload)
      .digest('hex');
  }
};

// Static methods
paymentSchema.statics = {
  // Find by payment ID
  async findByPaymentId(paymentId) {
    return this.findOne({ paymentId });
  },

  // Find pending payments
  async findPending() {
    return this.find({ status: 'pending' });
  },

  // Find processing payments
  async findProcessing() {
    return this.find({ status: 'processing' });
  },

  // Find failed payments
  async findFailed() {
    return this.find({ status: 'failed' });
  },

  // Get user payment history
  async getUserPayments(userId, limit = 50, offset = 0) {
    return this.find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
  },

  // Get payment statistics
  async getStatistics(userId = null, startDate = null, endDate = null) {
    const match = {};
    
    if (userId) match.userId = userId;
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          averageAmount: { $avg: '$amount' }
        }
      }
    ]);
  }
};

module.exports = mongoose.model('Payment', paymentSchema); 