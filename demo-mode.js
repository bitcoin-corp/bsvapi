#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const { logger } = require('./src/utils/logger');
const bsvService = require('./src/utils/bsv');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'BSV Micropayments API - Demo Mode',
    version: '1.0.0',
    mode: 'demo'
  });
});

// Demo BSV endpoints
app.get('/api/demo/bsv/network-info', (req, res) => {
  try {
    const networkInfo = bsvService.getNetworkInfo();
    res.json({
      success: true,
      data: networkInfo
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get network info',
      message: error.message
    });
  }
});

app.post('/api/demo/bsv/generate-address', (req, res) => {
  try {
    const address = bsvService.generateAddress();
    res.json({
      success: true,
      data: address
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate address',
      message: error.message
    });
  }
});

app.post('/api/demo/bsv/create-payment-request', (req, res) => {
  try {
    const { amount, description } = req.body;
    
    if (!amount || !description) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Amount and description are required'
      });
    }

    const paymentRequest = bsvService.createPaymentRequest(amount, description);
    res.json({
      success: true,
      data: paymentRequest
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create payment request',
      message: error.message
    });
  }
});

app.post('/api/demo/bsv/validate-transaction', (req, res) => {
  try {
    const { txHex } = req.body;
    
    if (!txHex) {
      return res.status(400).json({
        error: 'Missing transaction hex',
        message: 'Transaction hex is required'
      });
    }

    const validation = bsvService.validateTransaction(txHex);
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to validate transaction',
      message: error.message
    });
  }
});

// Demo API proxy endpoints
app.get('/api/demo/proxy/weather/:city', (req, res) => {
  const { city } = req.params;
  
  // Simulate weather API response
  const mockWeatherData = {
    city: city,
    temperature: Math.floor(Math.random() * 30) + 10,
    condition: ['Sunny', 'Cloudy', 'Rainy', 'Snowy'][Math.floor(Math.random() * 4)],
    humidity: Math.floor(Math.random() * 40) + 30,
    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    data: mockWeatherData,
    message: 'Demo weather data (not real)'
  });
});

app.get('/api/demo/proxy/crypto/:symbol', (req, res) => {
  const { symbol } = req.params;
  
  // Simulate crypto price data
  const mockCryptoData = {
    symbol: symbol.toUpperCase(),
    price: Math.random() * 50000,
    change24h: (Math.random() - 0.5) * 20,
    volume: Math.random() * 1000000000,
    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    data: mockCryptoData,
    message: 'Demo crypto data (not real)'
  });
});

// Demo payment simulation
app.post('/api/demo/payments/simulate', (req, res) => {
  const { amount, description } = req.body;
  
  if (!amount || !description) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Amount and description are required'
    });
  }

  const paymentId = bsvService.generatePaymentId();
  const serviceFee = bsvService.calculateServiceFee(amount);
  
  res.json({
    success: true,
    data: {
      paymentId,
      amount,
      serviceFee,
      totalAmount: amount + serviceFee,
      description,
      status: 'pending',
      network: bsvService.network,
      message: 'This is a demo payment simulation'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 BSV Micropayments API Demo Mode running on port ${PORT}`);
  logger.info(`🌐 Web Dashboard: http://localhost:${PORT}/`);
  logger.info(`📚 Health check: http://localhost:${PORT}/health`);
  logger.info(`💰 BSV endpoints: http://localhost:${PORT}/api/demo/bsv/`);
  logger.info(`🔌 Demo API proxy: http://localhost:${PORT}/api/demo/proxy/`);
  logger.info(`💳 Demo payments: http://localhost:${PORT}/api/demo/payments/`);
  logger.info(`⚠️  This is DEMO MODE - no real database or Redis required`);
});

module.exports = app; 