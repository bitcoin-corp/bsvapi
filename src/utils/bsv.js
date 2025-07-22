const bsv = require('bsv');
const { logger } = require('./logger');

class BSVService {
  constructor() {
    this.network = process.env.BSV_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
    this.minerFee = parseInt(process.env.BSV_MINER_FEE || '1000'); // 1000 satoshis
    this.serviceFee = parseFloat(process.env.BSV_SERVICE_FEE || '0.01'); // 1% service fee
  }

  /**
   * Generate a new BSV address
   */
  generateAddress() {
    try {
      const privateKey = bsv.PrivKey.fromRandom();
      const address = bsv.Address.fromPrivKey(privateKey);
      
      return {
        privateKey: privateKey.toString(),
        publicKey: address.toString(), // For simplicity, using address as public key
        address: address.toString(),
        network: this.network
      };
    } catch (error) {
      logger.error('Error generating BSV address:', error);
      throw new Error('Failed to generate BSV address');
    }
  }

  /**
   * Create a payment request for micropayments
   */
  createPaymentRequest(amount, description, callbackUrl = null) {
    try {
      const paymentRequest = {
        id: this.generatePaymentId(),
        amount: amount,
        description: description,
        callbackUrl: callbackUrl,
        createdAt: new Date(),
        status: 'pending',
        network: this.network,
        minerFee: this.minerFee,
        totalAmount: amount + this.minerFee
      };

      return paymentRequest;
    } catch (error) {
      logger.error('Error creating payment request:', error);
      throw new Error('Failed to create payment request');
    }
  }

  /**
   * Validate BSV transaction
   */
  validateTransaction(txHex) {
    try {
      const tx = bsv.Tx.fromHex(txHex);
      
      // Basic validation
      if (!tx.isValid()) {
        throw new Error('Invalid transaction');
      }

      return {
        isValid: true,
        txid: tx.hash,
        inputs: tx.txIns.length,
        outputs: tx.txOuts.length,
        fee: this.calculateFee(tx)
      };
    } catch (error) {
      logger.error('Error validating transaction:', error);
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate transaction fee
   */
  calculateFee(tx) {
    try {
      let inputValue = 0;
      let outputValue = 0;

      // Calculate input value
      tx.txIns.forEach(input => {
        if (input.txOut && input.txOut.valueBn) {
          inputValue += input.txOut.valueBn.toNumber();
        }
      });

      // Calculate output value
      tx.txOuts.forEach(output => {
        outputValue += output.valueBn.toNumber();
      });

      return inputValue - outputValue;
    } catch (error) {
      logger.error('Error calculating transaction fee:', error);
      return 0;
    }
  }

  /**
   * Generate unique payment ID
   */
  generatePaymentId() {
    return 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Calculate service fee
   */
  calculateServiceFee(amount) {
    return Math.ceil(amount * this.serviceFee);
  }

  /**
   * Parse BSV amount from satoshis to BSV
   */
  satoshisToBSV(satoshis) {
    return satoshis / 100000000;
  }

  /**
   * Parse BSV amount from BSV to satoshis
   */
  bsvToSatoshis(bsvAmount) {
    return Math.floor(bsvAmount * 100000000);
  }

  /**
   * Create a micropayment channel
   */
  createMicropaymentChannel(userId, initialBalance) {
    try {
      const channel = {
        id: 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        userId: userId,
        balance: initialBalance,
        status: 'active',
        createdAt: new Date(),
        lastActivity: new Date(),
        transactions: []
      };

      return channel;
    } catch (error) {
      logger.error('Error creating micropayment channel:', error);
      throw new Error('Failed to create micropayment channel');
    }
  }

  /**
   * Process micropayment from channel
   */
  processMicropayment(channel, amount, description) {
    try {
      if (channel.balance < amount) {
        throw new Error('Insufficient balance in micropayment channel');
      }

      const payment = {
        id: 'mp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        amount: amount,
        description: description,
        timestamp: new Date(),
        channelId: channel.id
      };

      // Update channel balance
      channel.balance -= amount;
      channel.lastActivity = new Date();
      channel.transactions.push(payment);

      return {
        success: true,
        payment: payment,
        newBalance: channel.balance
      };
    } catch (error) {
      logger.error('Error processing micropayment:', error);
      throw error;
    }
  }

  /**
   * Get network information
   */
  getNetworkInfo() {
    return {
      network: this.network,
      minerFee: this.minerFee,
      serviceFee: this.serviceFee,
      isTestnet: this.network === 'testnet'
    };
  }
}

module.exports = new BSVService(); 