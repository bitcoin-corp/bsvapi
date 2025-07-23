const bsvNode = require('../utils/bsv-node');
const { logger } = require('../utils/logger');
const Payment = require('../models/Payment');
const User = require('../models/User');
const axios = require('axios');

class PaymentProcessor {
  constructor() {
    this.confirmationThreshold = parseInt(process.env.PAYMENT_CONFIRMATION_THRESHOLD || '1');
    this.webhookTimeout = parseInt(process.env.WEBHOOK_TIMEOUT || '10000'); // 10 seconds
    this.maxRetries = parseInt(process.env.WEBHOOK_MAX_RETRIES || '3');
  }

  /**
   * Process a new payment request
   */
  async processPaymentRequest(paymentData) {
    try {
      const {
        userId,
        amount,
        description,
        callbackUrl,
        type,
        recipientAddress
      } = paymentData;

      // Validate recipient address
      const addressValidation = bsvNode.validateAddress(recipientAddress);
      if (!addressValidation.isValid) {
        throw new Error(`Invalid recipient address: ${addressValidation.error}`);
      }

      // Create payment record
      const payment = new Payment({
        paymentId: this.generatePaymentId(),
        userId: userId,
        type: type,
        amount: amount,
        currency: 'satoshis',
        status: 'pending',
        recipientAddress: recipientAddress,
        metadata: {
          description,
          callbackUrl,
          ipAddress: paymentData.ipAddress,
          userAgent: paymentData.userAgent
        },
        fees: {
          minerFee: await bsvNode.calculateOptimalFee('medium'),
          serviceFee: bsvNode.calculateServiceFee(amount),
          totalFees: 0 // Will be calculated below
        }
      });

      // Calculate total fees
      payment.fees.totalFees = payment.fees.minerFee + payment.fees.serviceFee;
      payment.totalAmount = amount + payment.fees.totalFees;

      await payment.save();

      // Generate payment address for this transaction
      const paymentAddress = bsvNode.generateAddress();
      payment.paymentAddress = paymentAddress.address;
      payment.paymentPrivateKey = paymentAddress.privateKey;
      await payment.save();

      logger.info(`Payment request created: ${payment.paymentId} for ${amount} satoshis`);

      return {
        success: true,
        paymentId: payment.paymentId,
        paymentAddress: paymentAddress.address,
        amount: amount,
        totalAmount: payment.totalAmount,
        fees: payment.fees,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
    } catch (error) {
      logger.error('Error processing payment request:', error);
      throw error;
    }
  }

  /**
   * Monitor payment and process when received
   */
  async monitorPayment(paymentId) {
    try {
      const payment = await Payment.findOne({ paymentId });
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Check if payment has been received
      const addressInfo = await bsvNode.getAddressInfo(payment.paymentAddress);
      
      if (addressInfo.balance >= payment.totalAmount) {
        // Payment received, process it
        await this.processReceivedPayment(payment, addressInfo);
      }

      return {
        paymentId: payment.paymentId,
        status: payment.status,
        receivedAmount: addressInfo.balance,
        requiredAmount: payment.totalAmount,
        isComplete: addressInfo.balance >= payment.totalAmount
      };
    } catch (error) {
      logger.error(`Error monitoring payment ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Process a received payment
   */
  async processReceivedPayment(payment, addressInfo) {
    try {
      // Update payment status
      payment.status = 'received';
      payment.receivedAt = new Date();
      payment.receivedAmount = addressInfo.balance;
      await payment.save();

      // Create transaction to send to recipient
      const transaction = await bsvNode.createPaymentTransaction(
        payment.paymentAddress,
        payment.recipientAddress,
        payment.amount,
        payment.paymentPrivateKey
      );

      // Broadcast transaction
      const broadcastResult = await bsvNode.broadcastTransaction(transaction.txHex);

      // Update payment with transaction details
      payment.status = 'processing';
      payment.transactionId = broadcastResult.txid;
      payment.transactionHex = transaction.txHex;
      await payment.save();

      // Start monitoring transaction confirmations
      this.monitorTransactionConfirmations(payment.paymentId, broadcastResult.txid);

      logger.info(`Payment processed: ${payment.paymentId} -> ${broadcastResult.txid}`);

      return {
        success: true,
        paymentId: payment.paymentId,
        transactionId: broadcastResult.txid,
        status: 'processing'
      };
    } catch (error) {
      logger.error(`Error processing received payment ${payment.paymentId}:`, error);
      
      // Update payment status to failed
      payment.status = 'failed';
      payment.error = error.message;
      await payment.save();

      throw error;
    }
  }

  /**
   * Monitor transaction confirmations
   */
  async monitorTransactionConfirmations(paymentId, txid) {
    try {
      const payment = await Payment.findOne({ paymentId });
      if (!payment) return;

      let confirmations = 0;
      let retries = 0;
      const maxRetries = 10;

      const checkConfirmations = async () => {
        try {
          const txInfo = await bsvNode.monitorTransaction(txid, this.confirmationThreshold);
          confirmations = txInfo.confirmations;

          // Update payment with confirmation count
          payment.confirmations = confirmations;
          await payment.save();

          if (txInfo.isConfirmed) {
            // Payment confirmed
            payment.status = 'confirmed';
            payment.confirmedAt = new Date();
            await payment.save();

            // Send webhook notification
            await this.sendWebhookNotification(payment);

            logger.info(`Payment confirmed: ${paymentId} with ${confirmations} confirmations`);
            return;
          }

          // Continue monitoring if not confirmed
          if (retries < maxRetries) {
            retries++;
            setTimeout(checkConfirmations, 60000); // Check every minute
          } else {
            // Mark as failed if too many retries
            payment.status = 'failed';
            payment.error = 'Transaction confirmation timeout';
            await payment.save();
            logger.error(`Payment confirmation timeout: ${paymentId}`);
          }
        } catch (error) {
          logger.error(`Error checking confirmations for ${paymentId}:`, error);
          if (retries < maxRetries) {
            retries++;
            setTimeout(checkConfirmations, 60000);
          }
        }
      };

      // Start monitoring
      setTimeout(checkConfirmations, 30000); // First check after 30 seconds
    } catch (error) {
      logger.error(`Error monitoring transaction confirmations for ${paymentId}:`, error);
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhookNotification(payment) {
    if (!payment.metadata.callbackUrl) return;

    try {
      const webhookData = {
        paymentId: payment.paymentId,
        status: payment.status,
        amount: payment.amount,
        transactionId: payment.transactionId,
        confirmations: payment.confirmations,
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(payment.metadata.callbackUrl, webhookData, {
        timeout: this.webhookTimeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BSV-Micropayments-API/1.0.0'
        }
      });

      logger.info(`Webhook sent successfully for payment ${payment.paymentId}`);
    } catch (error) {
      logger.error(`Webhook failed for payment ${payment.paymentId}:`, error.message);
      
      // Retry webhook with exponential backoff
      await this.retryWebhook(payment, 1);
    }
  }

  /**
   * Retry webhook with exponential backoff
   */
  async retryWebhook(payment, attempt) {
    if (attempt > this.maxRetries) {
      logger.error(`Webhook max retries exceeded for payment ${payment.paymentId}`);
      return;
    }

    try {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));

      const webhookData = {
        paymentId: payment.paymentId,
        status: payment.status,
        amount: payment.amount,
        transactionId: payment.transactionId,
        confirmations: payment.confirmations,
        timestamp: new Date().toISOString()
      };

      await axios.post(payment.metadata.callbackUrl, webhookData, {
        timeout: this.webhookTimeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BSV-Micropayments-API/1.0.0'
        }
      });

      logger.info(`Webhook retry successful for payment ${payment.paymentId} (attempt ${attempt})`);
    } catch (error) {
      logger.error(`Webhook retry failed for payment ${payment.paymentId} (attempt ${attempt}):`, error.message);
      await this.retryWebhook(payment, attempt + 1);
    }
  }

  /**
   * Create a micropayment channel
   */
  async createMicropaymentChannel(userId, initialBalance, fundingAddress) {
    try {
      const channel = await bsvNode.createMicropaymentChannel(userId, initialBalance, fundingAddress);
      
      // Save channel to database
      const channelRecord = new Payment({
        paymentId: channel.channelId,
        userId: userId,
        type: 'channel_funding',
        amount: initialBalance,
        currency: 'satoshis',
        status: 'funding',
        paymentAddress: channel.address,
        metadata: {
          description: 'Micropayment channel funding',
          channelId: channel.channelId,
          fundingTxid: channel.fundingTxid
        }
      });

      await channelRecord.save();

      return {
        success: true,
        channelId: channel.channelId,
        address: channel.address,
        balance: channel.balance,
        fundingTxid: channel.fundingTxid,
        status: 'funding'
      };
    } catch (error) {
      logger.error('Error creating micropayment channel:', error);
      throw error;
    }
  }

  /**
   * Process micropayment from channel
   */
  async processChannelPayment(channelId, amount, toAddress) {
    try {
      // Get channel from database
      const channelRecord = await Payment.findOne({ paymentId: channelId });
      if (!channelRecord) {
        throw new Error('Channel not found');
      }

      // Process micropayment
      const channel = {
        address: channelRecord.paymentAddress,
        privateKey: channelRecord.paymentPrivateKey,
        balance: channelRecord.balance || 0
      };

      const result = await bsvNode.processMicropayment(channel, amount, toAddress);

      // Update channel balance
      channelRecord.balance = result.newBalance;
      channelRecord.lastActivity = new Date();
      await channelRecord.save();

      // Create payment record for this micropayment
      const micropayment = new Payment({
        paymentId: `mp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: channelRecord.userId,
        type: 'micropayment',
        amount: amount,
        currency: 'satoshis',
        status: 'confirmed',
        recipientAddress: toAddress,
        transactionId: result.txid,
        confirmedAt: new Date(),
        metadata: {
          description: 'Micropayment from channel',
          channelId: channelId,
          fee: result.fee
        }
      });

      await micropayment.save();

      return {
        success: true,
        paymentId: micropayment.paymentId,
        transactionId: result.txid,
        amount: amount,
        fee: result.fee,
        newBalance: result.newBalance
      };
    } catch (error) {
      logger.error(`Error processing channel payment for ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Generate unique payment ID
   */
  generatePaymentId() {
    return 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(userId = null) {
    try {
      const match = userId ? { userId } : {};
      
      const stats = await Payment.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const totalPayments = await Payment.countDocuments(match);
      const totalAmount = await Payment.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      return {
        totalPayments,
        totalAmount: totalAmount[0]?.total || 0,
        byStatus: stats.reduce((acc, stat) => {
          acc[stat._id] = { count: stat.count, amount: stat.totalAmount };
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Error getting payment stats:', error);
      throw error;
    }
  }
}

module.exports = new PaymentProcessor(); 