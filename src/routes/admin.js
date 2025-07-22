const express = require('express');
const { logger } = require('../utils/logger');
const User = require('../models/User');
const APIService = require('../models/APIService');
const Payment = require('../models/Payment');
const { authenticateToken, requireRole, verifyUser } = require('../middleware/auth');
const { adminRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get('/dashboard', authenticateToken, requireRole('admin'), adminRateLimiter, async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    // Get API service statistics
    const totalServices = await APIService.countDocuments();
    const activeServices = await APIService.countDocuments({ status: 'active' });
    const totalApiCalls = await APIService.aggregate([
      { $group: { _id: null, total: { $sum: '$statistics.totalRequests' } } }
    ]);

    // Get payment statistics
    const totalPayments = await Payment.countDocuments();
    const completedPayments = await Payment.countDocuments({ status: 'completed' });
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get recent activity
    const recentPayments = await Payment.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'email username');

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('email username role createdAt');

    res.json({
      statistics: {
        users: {
          total: totalUsers,
          active: activeUsers,
          newToday: newUsersToday
        },
        services: {
          total: totalServices,
          active: activeServices,
          totalApiCalls: totalApiCalls[0]?.total || 0
        },
        payments: {
          total: totalPayments,
          completed: completedPayments,
          totalRevenue: totalRevenue[0]?.total || 0
        }
      },
      recentActivity: {
        payments: recentPayments,
        users: recentUsers
      }
    });

  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get dashboard statistics'
    });
  }
});

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Admin]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, admin, premium]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get('/users', authenticateToken, requireRole('admin'), adminRateLimiter, async (req, res) => {
  try {
    const { limit = 50, offset = 0, role, status } = req.query;

    // Build query
    const query = {};
    if (role) query.role = role;
    if (status) query.isActive = status === 'active';

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .select('-password -resetPasswordToken -resetPasswordExpires -verificationToken -verificationExpires');

    const total = await User.countDocuments(query);

    res.json({
      users: users.map(user => ({
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
        balance: user.balance,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + users.length
      }
    });

  } catch (error) {
    logger.error('Admin get users error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get users'
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   put:
 *     summary: Update user (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin, premium]
 *               isActive:
 *                 type: boolean
 *               isVerified:
 *                 type: boolean
 *               balance:
 *                 type: number
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put('/users/:userId', authenticateToken, requireRole('admin'), adminRateLimiter, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, isActive, isVerified, balance } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    // Build updates
    const updates = {};
    if (role) updates.role = role;
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    if (typeof isVerified === 'boolean') updates.isVerified = isVerified;
    if (typeof balance === 'number') updates.balance = balance;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires -verificationToken -verificationExpires');

    logger.info(`Admin updated user: ${updatedUser.email}`);

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        isVerified: updatedUser.isVerified,
        balance: updatedUser.balance,
        lastLogin: updatedUser.lastLogin,
        createdAt: updatedUser.createdAt
      }
    });

  } catch (error) {
    logger.error('Admin update user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user'
    });
  }
});

/**
 * @swagger
 * /api/admin/services:
 *   get:
 *     summary: Get all API services (admin only)
 *     tags: [Admin]
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
 *           enum: [active, inactive, maintenance, deprecated]
 *     responses:
 *       200:
 *         description: API services retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get('/services', authenticateToken, requireRole('admin'), adminRateLimiter, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;

    const services = await APIService.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('createdBy', 'email username');

    const total = await APIService.countDocuments(query);

    res.json({
      services: services.map(service => ({
        id: service._id,
        name: service.name,
        slug: service.slug,
        description: service.description,
        category: service.category,
        status: service.status,
        pricing: service.pricing,
        healthCheck: service.healthCheck,
        statistics: service.statistics,
        createdBy: service.createdBy,
        createdAt: service.createdAt
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + services.length
      }
    });

  } catch (error) {
    logger.error('Admin get services error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get API services'
    });
  }
});

/**
 * @swagger
 * /api/admin/payments:
 *   get:
 *     summary: Get all payments (admin only)
 *     tags: [Admin]
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
 *         description: Payments retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get('/payments', authenticateToken, requireRole('admin'), adminRateLimiter, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, type } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('userId', 'email username')
      .populate('apiServiceId', 'name slug');

    const total = await Payment.countDocuments(query);

    res.json({
      payments: payments.map(payment => ({
        id: payment.paymentId,
        userId: payment.userId,
        apiServiceId: payment.apiServiceId,
        type: payment.type,
        amount: payment.amount,
        totalAmount: payment.totalAmount,
        currency: payment.currency,
        status: payment.status,
        fees: payment.fees,
        bsvTransaction: payment.bsvTransaction,
        metadata: payment.metadata,
        processing: payment.processing,
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
    logger.error('Admin get payments error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get payments'
    });
  }
});

module.exports = router; 