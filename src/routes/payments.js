const express = require('express');
const Joi = require('joi');
const { logger } = require('../utils/logger');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { authenticateToken, verifyUser } = require('../middleware/auth');
const { paymentRateLimiter } = require('../middleware/rateLimiter');
const bsvService = require('../utils/bsv');

const router = express.Router();

// Validation schemas
const createPaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  description: Joi.string().max(200).required(),
  callbackUrl: Joi.string().uri().optional(),
  type: Joi.string().valid('deposit', 'withdrawal', 'api_call').required()
});

const processPaymentSchema = Joi.object({
  paymentId: Joi.string().required(),
  txHex: Joi.string().optional(),
  confirmations: Joi.number().min(0).optional()
});

/**
 * @swagger
 * /api/payments/create:
 *   post:
 *     summary: Create a new payment request
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - description
 *               - type
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               description:
 *                 type: string
 *                 maxLength: 200
 *               callbackUrl:
 *                 type: string
 *                 format: uri
 *               type:
 *                 type: string
 *                 enum: [deposit, withdrawal, api_call]
 *     responses:
 *       201:
 *         description: Payment request created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/create', authenticateToken, verifyUser, paymentRateLimiter, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createPaymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { amount, description, callbackUrl, type } = value;

    // Create payment record
    const payment = new Payment({
      paymentId: bsvService.generatePaymentId(),
      userId: req.currentUser._id,
      type,
      amount,
      currency: 'satoshis',
      status: 'pending',
      metadata: {
        description,
        callbackUrl,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        referrer: req.get('Referrer')
      },
      fees: {
        minerFee: bsvService.minerFee,
        serviceFee: bsvService.calculateServiceFee(amount),
        totalFees: bsvService.minerFee + bsvService.calculateServiceFee(amount)
      }
    });

    await payment.save();

    // Create BSV payment request
    const paymentRequest = bsvService.createPaymentRequest(
      payment.totalAmount,
      description,
      callbackUrl
    );

    logger.info(`Payment request created: ${payment.paymentId} for user ${req.currentUser.email}`);

    res.status(201).json({
      message: 'Payment request created successfully',
      payment: {
        id: payment.paymentId,
        amount: payment.amount,
        totalAmount: payment.totalAmount,
        fees: payment.fees,
        status: payment.status,
        description: payment.metadata.description,
        createdAt: payment.createdAt
      },
      bsvRequest: paymentRequest
    });

  } catch (error) {
    logger.error('Create payment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create payment request'
    });
  }
});

/**
 * @swagger
 * /api/payments/process:
 *   post:
 *     summary: Process a payment with BSV transaction
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *             properties:
 *               paymentId:
 *                 type: string
 *               txHex:
 *                 type: string
 *               confirmations:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Payment not found
 */
router.post('/process', authenticateToken, verifyUser, paymentRateLimiter, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = processPaymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { paymentId, txHex, confirmations } = value;

    // Find payment
    const payment = await Payment.findByPaymentId(paymentId);
    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'The specified payment does not exist'
      });
    }

    // Verify payment belongs to user
    if (payment.userId.toString() !== req.currentUser._id.toString()) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only process your own payments'
      });
    }

    // Start processing
    await payment.startProcessing();

    try {
      // Validate BSV transaction if provided
      if (txHex) {
        const validation = bsvService.validateTransaction(txHex);
        if (!validation.isValid) {
          throw new Error(`Invalid transaction: ${validation.error}`);
        }

        // Update payment with transaction data
        await payment.updateBSVTransaction({
          txid: validation.txid,
          hex: txHex,
          confirmations: confirmations || 0,
          fee: validation.fee
        });
      }

      // Complete processing
      await payment.completeProcessing();

      // Update user balance if it's a deposit
      if (payment.type === 'deposit') {
        await req.currentUser.addBalance(payment.amount);
      }

      // Send webhook if configured
      if (payment.metadata.callbackUrl) {
        await payment.sendWebhook();
      }

      logger.info(`Payment processed successfully: ${payment.paymentId}`);

      res.json({
        message: 'Payment processed successfully',
        payment: {
          id: payment.paymentId,
          status: payment.status,
          amount: payment.amount,
          totalAmount: payment.totalAmount,
          bsvTransaction: payment.bsvTransaction,
          processedAt: payment.processing.completedAt
        }
      });

    } catch (processingError) {
      await payment.failProcessing(processingError.message);
      throw processingError;
    }

  } catch (error) {
    logger.error('Process payment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process payment'
    });
  }
});

/**
 * @swagger
 * /api/payments/{paymentId}:
 *   get:
 *     summary: Get payment details
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details retrieved successfully
 *       404:
 *         description: Payment not found
 */
router.get('/:paymentId', authenticateToken, verifyUser, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findByPaymentId(paymentId);
    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'The specified payment does not exist'
      });
    }

    // Verify payment belongs to user (unless admin)
    if (req.currentUser.role !== 'admin' && 
        payment.userId.toString() !== req.currentUser._id.toString()) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own payments'
      });
    }

    res.json({
      payment: {
        id: payment.paymentId,
        type: payment.type,
        amount: payment.amount,
        totalAmount: payment.totalAmount,
        currency: payment.currency,
        status: payment.status,
        fees: payment.fees,
        bsvTransaction: payment.bsvTransaction,
        metadata: payment.metadata,
        processing: payment.processing,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      }
    });

  } catch (error) {
    logger.error('Get payment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get payment details'
    });
  }
});

/**
 * @swagger
 * /api/payments/history:
 *   get:
 *     summary: Get user payment history
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled, refunded]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [deposit, withdrawal, api_call, refund, service_fee]
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
 */
router.get('/history', authenticateToken, verifyUser, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, type } = req.query;

    // Build query
    const query = { userId: req.currentUser._id };
    if (status) query.status = status;
    if (type) query.type = type;

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      payments: payments.map(payment => ({
        id: payment.paymentId,
        type: payment.type,
        amount: payment.amount,
        totalAmount: payment.totalAmount,
        currency: payment.currency,
        status: payment.status,
        metadata: payment.metadata,
        createdAt: payment.createdAt
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + payments.length
      }
    });

  } catch (error) {
    logger.error('Get payment history error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get payment history'
    });
  }
});

/**
 * @swagger
 * /api/payments/refund/{paymentId}:
 *   post:
 *     summary: Request a refund for a payment
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *               refundAmount:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       201:
 *         description: Refund request created successfully
 *       400:
 *         description: Payment not refundable
 *       404:
 *         description: Payment not found
 */
router.post('/refund/:paymentId', authenticateToken, verifyUser, paymentRateLimiter, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason, refundAmount } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Refund reason is required'
      });
    }

    const payment = await Payment.findByPaymentId(paymentId);
    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'The specified payment does not exist'
      });
    }

    // Verify payment belongs to user
    if (payment.userId.toString() !== req.currentUser._id.toString()) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only refund your own payments'
      });
    }

    // Check if payment is refundable
    if (!payment.isRefundable) {
      return res.status(400).json({
        error: 'Payment not refundable',
        message: 'This payment cannot be refunded'
      });
    }

    // Create refund
    const refund = await payment.createRefund(reason, refundAmount);

    logger.info(`Refund requested: ${refund.paymentId} for payment ${paymentId}`);

    res.status(201).json({
      message: 'Refund request created successfully',
      refund: {
        id: refund.paymentId,
        amount: refund.amount,
        reason: refund.metadata.reason,
        status: refund.status,
        createdAt: refund.createdAt
      }
    });

  } catch (error) {
    logger.error('Create refund error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create refund request'
    });
  }
});

/**
 * @swagger
 * /api/payments/network-info:
 *   get:
 *     summary: Get BSV network information
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Network information retrieved successfully
 */
router.get('/network-info', async (req, res) => {
  try {
    const networkInfo = bsvService.getNetworkInfo();
    
    res.json({
      network: networkInfo
    });

  } catch (error) {
    logger.error('Get network info error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get network information'
    });
  }
});

module.exports = router; 