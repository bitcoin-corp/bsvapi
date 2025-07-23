const { logger } = require('../utils/logger');
const APIService = require('../models/APIService');
const Payment = require('../models/Payment');

class ExchangeService {
  constructor() {
    this.exchangeRates = {
      BSV_USD: 0,
      lastUpdated: null
    };
    this.updateInterval = 5 * 60 * 1000; // 5 minutes
    this.init();
  }

  async init() {
    await this.updateExchangeRates();
    setInterval(() => this.updateExchangeRates(), this.updateInterval);
  }

  async updateExchangeRates() {
    try {
      // Get BSV/USD rate from multiple exchanges for accuracy
      const rates = await Promise.allSettled([
        this.getCoinbaseRate(),
        this.getBinanceRate(),
        this.getKrakenRate()
      ]);

      const validRates = rates
        .filter(result => result.status === 'fulfilled' && result.value > 0)
        .map(result => result.value);

      if (validRates.length > 0) {
        // Use average rate for stability
        this.exchangeRates.BSV_USD = validRates.reduce((a, b) => a + b, 0) / validRates.length;
        this.exchangeRates.lastUpdated = new Date();
        
        logger.info(`Exchange rates updated: BSV/USD = $${this.exchangeRates.BSV_USD.toFixed(2)}`);
      }
    } catch (error) {
      logger.error('Failed to update exchange rates:', error);
    }
  }

  async getCoinbaseRate() {
    try {
      const response = await fetch('https://api.coinbase.com/v2/prices/BSV-USD/spot');
      const data = await response.json();
      return parseFloat(data.data.amount);
    } catch (error) {
      logger.error('Coinbase rate fetch failed:', error);
      return 0;
    }
  }

  async getBinanceRate() {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BSVUSDT');
      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      logger.error('Binance rate fetch failed:', error);
      return 0;
    }
  }

  async getKrakenRate() {
    try {
      const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=BSVUSD');
      const data = await response.json();
      return parseFloat(data.result.BSVUSD.c[0]);
    } catch (error) {
      logger.error('Kraken rate fetch failed:', error);
      return 0;
    }
  }

  getBSVToUSD(bsvAmount) {
    return bsvAmount * this.exchangeRates.BSV_USD;
  }

  getUSDToBSV(usdAmount) {
    return usdAmount / this.exchangeRates.BSV_USD;
  }

  async processSupplierPayout(paymentId) {
    try {
      const payment = await Payment.findById(paymentId).populate('apiService');
      if (!payment || !payment.apiService) {
        throw new Error('Payment or API service not found');
      }

      const apiService = payment.apiService;
      const supplier = apiService.supplier;

      // Calculate supplier payout (platform takes a percentage)
      const platformFee = 0.10; // 10% platform fee
      const supplierPayoutUSD = payment.amountUSD * (1 - platformFee);

      // Convert to supplier's preferred currency if different from USD
      const payoutAmount = await this.convertToSupplierCurrency(supplierPayoutUSD, supplier.preferredCurrency);

      // Process payment via traditional payment method
      const payoutResult = await this.processTraditionalPayout({
        supplierId: supplier.id,
        amount: payoutAmount,
        currency: supplier.preferredCurrency || 'USD',
        paymentMethod: supplier.paymentMethod, // 'stripe', 'paypal', 'bank_transfer'
        description: `Payout for API service: ${apiService.name}`,
        paymentId: payment.id
      });

      // Update payment record
      payment.supplierPayout = {
        amount: payoutAmount,
        currency: supplier.preferredCurrency || 'USD',
        method: supplier.paymentMethod,
        transactionId: payoutResult.transactionId,
        status: payoutResult.status,
        processedAt: new Date()
      };

      await payment.save();

      logger.info(`Supplier payout processed: ${payoutAmount} ${supplier.preferredCurrency || 'USD'} to ${supplier.name}`);

      return payoutResult;
    } catch (error) {
      logger.error('Supplier payout processing failed:', error);
      throw error;
    }
  }

  async convertToSupplierCurrency(usdAmount, targetCurrency) {
    if (targetCurrency === 'USD') {
      return usdAmount;
    }

    try {
      // Get exchange rate for target currency
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
      const data = await response.json();
      const rate = data.rates[targetCurrency];
      
      if (!rate) {
        logger.warn(`Exchange rate not found for ${targetCurrency}, using USD`);
        return usdAmount;
      }

      return usdAmount * rate;
    } catch (error) {
      logger.error(`Currency conversion failed for ${targetCurrency}:`, error);
      return usdAmount; // Fallback to USD
    }
  }

  async processTraditionalPayout(payoutData) {
    try {
      switch (payoutData.paymentMethod) {
        case 'stripe':
          return await this.processStripePayout(payoutData);
        case 'paypal':
          return await this.processPayPalPayout(payoutData);
        case 'bank_transfer':
          return await this.processBankTransferPayout(payoutData);
        default:
          throw new Error(`Unsupported payment method: ${payoutData.paymentMethod}`);
      }
    } catch (error) {
      logger.error('Traditional payout processing failed:', error);
      throw error;
    }
  }

  async processStripePayout(payoutData) {
    // This would integrate with Stripe Connect for payouts
    // For now, return a mock successful transaction
    return {
      transactionId: `stripe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      method: 'stripe',
      amount: payoutData.amount,
      currency: payoutData.currency
    };
  }

  async processPayPalPayout(payoutData) {
    // This would integrate with PayPal Payouts API
    // For now, return a mock successful transaction
    return {
      transactionId: `paypal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      method: 'paypal',
      amount: payoutData.amount,
      currency: payoutData.currency
    };
  }

  async processBankTransferPayout(payoutData) {
    // This would integrate with bank transfer APIs
    // For now, return a mock successful transaction
    return {
      transactionId: `bank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      method: 'bank_transfer',
      amount: payoutData.amount,
      currency: payoutData.currency
    };
  }

  async scheduleSupplierPayouts() {
    try {
      // Find payments that need supplier payouts
      const pendingPayments = await Payment.find({
        status: 'confirmed',
        'supplierPayout.status': { $exists: false }
      }).populate('apiService');

      for (const payment of pendingPayments) {
        try {
          await this.processSupplierPayout(payment.id);
          logger.info(`Scheduled payout processed for payment ${payment.id}`);
        } catch (error) {
          logger.error(`Failed to process scheduled payout for payment ${payment.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Supplier payout scheduling failed:', error);
    }
  }

  getExchangeRates() {
    return {
      BSV_USD: this.exchangeRates.BSV_USD,
      lastUpdated: this.exchangeRates.lastUpdated
    };
  }
}

module.exports = new ExchangeService(); 