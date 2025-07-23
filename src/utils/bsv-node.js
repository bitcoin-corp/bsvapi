const bsv = require('bsv');
const axios = require('axios');
const { logger } = require('./logger');

class BSVNodeService {
  constructor() {
    this.network = process.env.BSV_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
    this.nodeUrl = process.env.BSV_NODE_URL || 'https://api.bitails.io';
    this.apiKey = process.env.BSV_API_KEY;
    this.minerFee = parseInt(process.env.BSV_MINER_FEE || '1000'); // 1000 satoshis
    this.serviceFee = parseFloat(process.env.BSV_SERVICE_FEE || '0.01'); // 1% service fee
    
    // HD Wallet for managing addresses
    this.masterKey = process.env.BSV_MASTER_PRIVATE_KEY;
    this.hdWallet = this.masterKey ? bsv.HDPrivateKey.fromString(this.masterKey) : null;
    
    // Address index for HD wallet
    this.addressIndex = 0;
  }

  /**
   * Connect to BSV node and verify connection
   */
  async connect() {
    try {
      const response = await axios.get(`${this.nodeUrl}/api/status`);
      logger.info(`Connected to BSV node: ${this.nodeUrl}`);
      logger.info(`Network: ${this.network}`);
      return true;
    } catch (error) {
      logger.error('Failed to connect to BSV node:', error.message);
      return false;
    }
  }

  /**
   * Generate a new HD wallet address
   */
  generateAddress() {
    try {
      if (!this.hdWallet) {
        throw new Error('HD wallet not configured');
      }

      const childKey = this.hdWallet.deriveChild(`m/44'/0'/0'/0/${this.addressIndex}`);
      const address = bsv.Address.fromPrivKey(childKey.privateKey);
      
      this.addressIndex++;
      
      return {
        privateKey: childKey.privateKey.toString(),
        publicKey: childKey.publicKey.toString(),
        address: address.toString(),
        index: this.addressIndex - 1,
        network: this.network
      };
    } catch (error) {
      logger.error('Error generating HD address:', error);
      throw new Error('Failed to generate BSV address');
    }
  }

  /**
   * Get address balance and UTXOs
   */
  async getAddressInfo(address) {
    try {
      const response = await axios.get(`${this.nodeUrl}/api/address/${address}`);
      
      return {
        address: address,
        balance: response.data.balance || 0,
        utxos: response.data.utxos || [],
        txCount: response.data.txCount || 0
      };
    } catch (error) {
      logger.error(`Error getting address info for ${address}:`, error.message);
      throw new Error('Failed to get address information');
    }
  }

  /**
   * Create a payment transaction
   */
  async createPaymentTransaction(fromAddress, toAddress, amount, privateKey) {
    try {
      // Get UTXOs for the from address
      const addressInfo = await this.getAddressInfo(fromAddress);
      
      if (addressInfo.balance < amount + this.minerFee) {
        throw new Error('Insufficient balance');
      }

      // Create transaction
      const tx = new bsv.Tx();
      
      // Add inputs from UTXOs
      let inputValue = 0;
      for (const utxo of addressInfo.utxos) {
        if (inputValue >= amount + this.minerFee) break;
        
        const input = new bsv.TxIn()
          .from(utxo.txid, utxo.vout, bsv.Script.fromAddress(fromAddress))
          .sign(bsv.PrivKey.fromString(privateKey));
        
        tx.addTxIn(input);
        inputValue += utxo.satoshis;
      }

      // Add output to recipient
      const output = new bsv.TxOut()
        .to(toAddress, amount);
      tx.addTxOut(output);

      // Add change output if needed
      const change = inputValue - amount - this.minerFee;
      if (change > 546) { // Dust limit
        const changeOutput = new bsv.TxOut()
          .to(fromAddress, change);
        tx.addTxOut(changeOutput);
      }

      return {
        txHex: tx.toString(),
        txid: tx.hash,
        fee: this.minerFee,
        amount: amount
      };
    } catch (error) {
      logger.error('Error creating payment transaction:', error);
      throw new Error('Failed to create payment transaction');
    }
  }

  /**
   * Broadcast transaction to network
   */
  async broadcastTransaction(txHex) {
    try {
      const response = await axios.post(`${this.nodeUrl}/api/tx/send`, {
        txhex: txHex
      });
      
      return {
        success: true,
        txid: response.data.txid,
        message: 'Transaction broadcast successfully'
      };
    } catch (error) {
      logger.error('Error broadcasting transaction:', error.message);
      throw new Error('Failed to broadcast transaction');
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid) {
    try {
      const response = await axios.get(`${this.nodeUrl}/api/tx/${txid}`);
      
      return {
        txid: txid,
        blockHeight: response.data.blockHeight,
        confirmations: response.data.confirmations,
        inputs: response.data.inputs,
        outputs: response.data.outputs,
        fee: response.data.fee,
        size: response.data.size,
        timestamp: response.data.timestamp
      };
    } catch (error) {
      logger.error(`Error getting transaction ${txid}:`, error.message);
      throw new Error('Failed to get transaction details');
    }
  }

  /**
   * Monitor transaction confirmations
   */
  async monitorTransaction(txid, requiredConfirmations = 1) {
    try {
      const tx = await this.getTransaction(txid);
      
      return {
        txid: txid,
        confirmations: tx.confirmations,
        isConfirmed: tx.confirmations >= requiredConfirmations,
        blockHeight: tx.blockHeight
      };
    } catch (error) {
      logger.error(`Error monitoring transaction ${txid}:`, error.message);
      return {
        txid: txid,
        confirmations: 0,
        isConfirmed: false,
        error: error.message
      };
    }
  }

  /**
   * Create a micropayment channel
   */
  async createMicropaymentChannel(userId, initialBalance, fundingAddress) {
    try {
      // Generate channel address
      const channelAddress = this.generateAddress();
      
      // Create funding transaction
      const fundingTx = await this.createPaymentTransaction(
        fundingAddress,
        channelAddress.address,
        initialBalance,
        process.env.BSV_SERVICE_PRIVATE_KEY
      );

      // Broadcast funding transaction
      const broadcastResult = await this.broadcastTransaction(fundingTx.txHex);

      return {
        channelId: `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId,
        address: channelAddress.address,
        privateKey: channelAddress.privateKey,
        balance: initialBalance,
        fundingTxid: broadcastResult.txid,
        status: 'funding',
        createdAt: new Date()
      };
    } catch (error) {
      logger.error('Error creating micropayment channel:', error);
      throw new Error('Failed to create micropayment channel');
    }
  }

  /**
   * Process micropayment from channel
   */
  async processMicropayment(channel, amount, toAddress) {
    try {
      if (channel.balance < amount + this.minerFee) {
        throw new Error('Insufficient balance in micropayment channel');
      }

      // Create micropayment transaction
      const paymentTx = await this.createPaymentTransaction(
        channel.address,
        toAddress,
        amount,
        channel.privateKey
      );

      // Broadcast transaction
      const broadcastResult = await this.broadcastTransaction(paymentTx.txHex);

      // Update channel balance
      channel.balance -= (amount + this.minerFee);
      channel.lastActivity = new Date();

      return {
        success: true,
        txid: broadcastResult.txid,
        amount: amount,
        fee: this.minerFee,
        newBalance: channel.balance,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error processing micropayment:', error);
      throw error;
    }
  }

  /**
   * Get network statistics
   */
  async getNetworkStats() {
    try {
      const response = await axios.get(`${this.nodeUrl}/api/stats`);
      
      return {
        network: this.network,
        blockHeight: response.data.blockHeight,
        difficulty: response.data.difficulty,
        mempoolSize: response.data.mempoolSize,
        averageFee: response.data.averageFee,
        lastBlockTime: response.data.lastBlockTime
      };
    } catch (error) {
      logger.error('Error getting network stats:', error.message);
      return {
        network: this.network,
        error: 'Failed to get network statistics'
      };
    }
  }

  /**
   * Validate BSV address
   */
  validateAddress(address) {
    try {
      const addr = bsv.Address.fromString(address);
      return {
        isValid: true,
        address: address,
        network: addr.network.name
      };
    } catch (error) {
      return {
        isValid: false,
        address: address,
        error: 'Invalid BSV address'
      };
    }
  }

  /**
   * Calculate optimal fee based on network conditions
   */
  async calculateOptimalFee(priority = 'medium') {
    try {
      const stats = await this.getNetworkStats();
      
      // Base fee calculation based on priority
      const baseFees = {
        low: 500,      // 500 satoshis
        medium: 1000,  // 1000 satoshis
        high: 2000     // 2000 satoshis
      };

      let fee = baseFees[priority] || baseFees.medium;

      // Adjust based on mempool size
      if (stats.mempoolSize > 10000) {
        fee *= 1.5; // Increase fee if mempool is congested
      }

      return Math.ceil(fee);
    } catch (error) {
      logger.error('Error calculating optimal fee:', error);
      return this.minerFee; // Fallback to default fee
    }
  }
}

module.exports = new BSVNodeService(); 