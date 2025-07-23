const axios = require('axios');
const { logger } = require('../utils/logger');
const APIService = require('../models/APIService');
const Payment = require('../models/Payment');
const User = require('../models/User');

class ExchangeService {
  constructor() {
    this.exchangeRate = 0; // Will be updated from exchange API
    this.exchangeProvider = process.env.EXCHANGE_PROVIDER || 'coinbase';
    this.exchangeApiKey = process.env.EXCHANGE_API_KEY;
    this.exchangeSecret = process.env.EXCHANGE_SECRET;
    
    // Stablecoin configuration
    this.stablecoins = {
      USDC: {
        network: 'ethereum',
        contract: '0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C8C',
        decimals: 6
      },
      USDT: {
        network: 'ethereum',
        contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6
      },
      DAI: {
        network: 'ethereum',
        contract: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        decimals: 18
      }
    };
    
    // Update exchange rate periodically
    this.updateExchangeRate();
    setInterval(() => this.updateExchangeRate(), 60000); // Update every minute
  }

  /**
   * Update BSV to USD exchange rate
   */
  async updateExchangeRate() {
    try {
      let rate = 0;
      
      switch (this.exchangeProvider) {
        case 'coinbase':
          rate = await this.getCoinbaseRate();
          break;
        case 'binance':
          rate = await this.getBinanceRate();
          break;
        case 'kraken':
          rate = await this.getKrakenRate();
          break;
        default:
          rate = await this.getCoinbaseRate();
      }
      
      this.exchangeRate = rate;
      logger.info(`Updated BSV exchange rate: $${rate}`);
    } catch (error) {
      logger.error('Error updating exchange rate:', error);
    }
  }

  /**
   * Get BSV/USD rate from Coinbase
   */
  async getCoinbaseRate() {
    try {
      const response = await axios.get('https://api.coinbase.com/v2/prices/BSV-USD/spot');
      return parseFloat(response.data.data.amount);
    } catch (error) {
      logger.error('Error fetching Coinbase rate:', error);
      throw error;
    }
  }

  /**
   * Get BSV/USD rate from Binance
   */
  async getBinanceRate() {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BSVUSDT');
      return parseFloat(response.data.price);
    } catch (error) {
      logger.error('Error fetching Binance rate:', error);
      throw error;
    }
  }

  /**
   * Get BSV/USD rate from Kraken
   */
  async getKrakenRate() {
    try {
      const response = await axios.get('https://api.kraken.com/0/public/Ticker?pair=BSVUSD');
      const pair = response.data.result.BSVUSD;
      return parseFloat(pair.c[0]); // Current price
    } catch (error) {
      logger.error('Error fetching Kraken rate:', error);
      throw error;
    }
  }

  /**
   * Convert BSV satoshis to USD cents
   */
  convertBSVToUSD(satoshis) {
    if (this.exchangeRate === 0) {
      throw new Error('Exchange rate not available');
    }
    
    const bsvAmount = satoshis / 100000000; // Convert satoshis to BSV
    const usdAmount = bsvAmount * this.exchangeRate;
    return Math.round(usdAmount * 100); // Convert to cents
  }

  /**
   * Convert USD cents to BSV satoshis
   */
  convertUSDToBSV(usdCents) {
    if (this.exchangeRate === 0) {
      throw new Error('Exchange rate not available');
    }
    
    const usdAmount = usdCents / 100; // Convert cents to USD
    const bsvAmount = usdAmount / this.exchangeRate;
    return Math.round(bsvAmount * 100000000); // Convert to satoshis
  }

  /**
   * Process BSV payment and convert to stablecoin for supplier
   */
  async processPaymentForSupplier(paymentId) {
    try {
      const payment = await Payment.findOne({ paymentId });
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Get the API service that was used
      const apiService = await APIService.findById(payment.metadata.apiServiceId);
      if (!apiService) {
        throw new Error('API service not found');
      }

      // Calculate supplier's share (after BSVAPI fee)
      const bsvapiFee = this.calculateBSVAPIFee(payment.amount);
      const supplierShare = payment.amount - bsvapiFee;

      // Convert supplier's share to USD
      const supplierShareUSD = this.convertBSVToUSD(supplierShare);

      // Update API service revenue
      await apiService.incrementUsage(supplierShareUSD);

      // Log the conversion
      logger.info(`Payment ${paymentId}: ${supplierShare} satoshis → $${(supplierShareUSD / 100).toFixed(2)} USD`);

      // Check if supplier is eligible for payout
      if (apiService.isEligibleForPayout()) {
        await this.processSupplierPayout(apiService);
      }

      return {
        success: true,
        paymentId: payment.paymentId,
        bsvAmount: supplierShare,
        usdAmount: supplierShareUSD,
        bsvapiFee: bsvapiFee,
        supplierShare: supplierShareUSD
      };
    } catch (error) {
      logger.error(`Error processing payment for supplier: ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Calculate BSVAPI fee
   */
  calculateBSVAPIFee(amount) {
    const feePercentage = parseFloat(process.env.BSVAPI_FEE_PERCENTAGE || '0.05'); // 5%
    return Math.round(amount * feePercentage);
  }

  /**
   * Process payout to supplier in stablecoins
   */
  async processSupplierPayout(apiService) {
    try {
      const pendingAmount = apiService.stats.totalRevenue - apiService.stats.totalPayouts;
      
      if (pendingAmount < apiService.paymentConfig.minimumPayout) {
        logger.info(`Supplier ${apiService.supplierId} not eligible for payout. Pending: $${(pendingAmount / 100).toFixed(2)}`);
        return;
      }

      // Get supplier details
      const supplier = await User.findById(apiService.supplierId);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Send stablecoin payment
      const payoutResult = await this.sendStablecoinPayment(
        apiService.paymentConfig.stablecoinAddress,
        pendingAmount,
        apiService.paymentConfig.stablecoinType
      );

      // Update API service payout record
      await apiService.processPayout(pendingAmount);

      // Create payout record
      const payout = new Payment({
        paymentId: `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: apiService.supplierId,
        type: 'supplier_payout',
        amount: pendingAmount,
        currency: 'usd_cents',
        status: 'confirmed',
        recipientAddress: apiService.paymentConfig.stablecoinAddress,
        transactionId: payoutResult.txid,
        confirmedAt: new Date(),
        metadata: {
          description: `Payout for ${apiService.name}`,
          apiServiceId: apiService._id,
          stablecoinType: apiService.paymentConfig.stablecoinType,
          exchangeRate: this.exchangeRate
        }
      });

      await payout.save();

      logger.info(`Payout processed for supplier ${apiService.supplierId}: $${(pendingAmount / 100).toFixed(2)} ${apiService.paymentConfig.stablecoinType}`);

      return {
        success: true,
        payoutId: payout.paymentId,
        amount: pendingAmount,
        stablecoinType: apiService.paymentConfig.stablecoinType,
        transactionId: payoutResult.txid
      };
    } catch (error) {
      logger.error(`Error processing supplier payout for ${apiService._id}:`, error);
      throw error;
    }
  }

  /**
   * Send stablecoin payment to supplier
   */
  async sendStablecoinPayment(toAddress, amountUSD, stablecoinType) {
    try {
      // This would integrate with a real stablecoin payment service
      // For now, we'll simulate the payment
      
      const stablecoin = this.stablecoins[stablecoinType];
      if (!stablecoin) {
        throw new Error(`Unsupported stablecoin: ${stablecoinType}`);
      }

      // Convert USD cents to stablecoin amount
      const stablecoinAmount = this.convertUSDToStablecoin(amountUSD, stablecoinType);

      // In a real implementation, this would:
      // 1. Connect to Ethereum network
      // 2. Call the stablecoin contract's transfer function
      // 3. Wait for transaction confirmation
      // 4. Return transaction hash

      // Simulate transaction
      const txid = `0x${Math.random().toString(16).substr(2, 64)}`;
      
      logger.info(`Stablecoin payment sent: ${stablecoinAmount} ${stablecoinType} to ${toAddress}`);

      return {
        success: true,
        txid: txid,
        amount: stablecoinAmount,
        stablecoinType: stablecoinType,
        toAddress: toAddress
      };
    } catch (error) {
      logger.error('Error sending stablecoin payment:', error);
      throw error;
    }
  }

  /**
   * Convert USD cents to stablecoin amount
   */
  convertUSDToStablecoin(usdCents, stablecoinType) {
    const usdAmount = usdCents / 100; // Convert to USD
    const stablecoin = this.stablecoins[stablecoinType];
    
    // For USDC/USDT (6 decimals), DAI (18 decimals)
    const decimals = stablecoin.decimals;
    const amount = usdAmount * Math.pow(10, decimals);
    
    return Math.round(amount);
  }

  /**
   * Get current exchange rate
   */
  getCurrentRate() {
    return {
      bsvToUsd: this.exchangeRate,
      lastUpdated: new Date(),
      provider: this.exchangeProvider
    };
  }

  /**
   * Get exchange statistics
   */
  async getExchangeStats() {
    try {
      const totalPayments = await Payment.countDocuments({ type: 'api_call' });
      const totalPayouts = await Payment.countDocuments({ type: 'supplier_payout' });
      
      const totalBSVProcessed = await Payment.aggregate([
        { $match: { type: 'api_call', status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const totalUSDProcessed = await Payment.aggregate([
        { $match: { type: 'supplier_payout', status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      return {
        totalPayments,
        totalPayouts,
        totalBSVProcessed: totalBSVProcessed[0]?.total || 0,
        totalUSDProcessed: totalUSDProcessed[0]?.total || 0,
        currentRate: this.exchangeRate,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error getting exchange stats:', error);
      throw error;
    }
  }

  /**
   * Process scheduled payouts
   */
  async processScheduledPayouts() {
    try {
      const apiServices = await APIService.find({
        'paymentConfig.autoPayout': true,
        status: 'active'
      });

      for (const apiService of apiServices) {
        if (apiService.isEligibleForPayout()) {
          await this.processSupplierPayout(apiService);
        }
      }

      logger.info(`Processed scheduled payouts for ${apiServices.length} services`);
    } catch (error) {
      logger.error('Error processing scheduled payouts:', error);
      throw error;
    }
  }
}

module.exports = new ExchangeService(); 