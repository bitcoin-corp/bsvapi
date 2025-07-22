const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const { logger } = require('../src/utils/logger');
const bsvService = require('../src/utils/bsv');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// BitcoinSV Script Operations Reference
app.get('/api/demo/script/sigops', (req, res) => {
  const sigops = {
    cryptographic: {
      title: "Cryptographic Operations",
      description: "Digital signatures, hashing, and cryptographic verification",
      opcodes: [
        {
          name: "OP_CHECKSIG",
          hex: "0xac",
          description: "Verifies a signature against a public key and message hash",
          example: "OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG"
        },
        {
          name: "OP_CHECKSIGVERIFY",
          hex: "0xad",
          description: "Same as OP_CHECKSIG but fails the script if verification fails",
          example: "OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIGVERIFY"
        },
        {
          name: "OP_CHECKMULTISIG",
          hex: "0xae",
          description: "Verifies multiple signatures against multiple public keys",
          example: "2 <pubKey1> <pubKey2> <pubKey3> 3 OP_CHECKMULTISIG"
        },
        {
          name: "OP_CHECKMULTISIGVERIFY",
          hex: "0xaf",
          description: "Same as OP_CHECKMULTISIG but fails the script if verification fails",
          example: "2 <pubKey1> <pubKey2> <pubKey3> 3 OP_CHECKMULTISIGVERIFY"
        },
        {
          name: "OP_CHECKDATASIG",
          hex: "0xba",
          description: "Verifies a signature against arbitrary data (BitcoinSV extension)",
          example: "<data> <signature> <publicKey> OP_CHECKDATASIG"
        },
        {
          name: "OP_CHECKDATASIGVERIFY",
          hex: "0xbb",
          description: "Same as OP_CHECKDATASIG but fails the script if verification fails",
          example: "<data> <signature> <publicKey> OP_CHECKDATASIGVERIFY"
        }
      ]
    },
    stack: {
      title: "Stack Operations",
      description: "Manipulate the stack - the core data structure of Bitcoin Script",
      opcodes: [
        {
          name: "OP_DUP",
          hex: "0x76",
          description: "Duplicates the top stack item",
          example: "<data> OP_DUP"
        },
        {
          name: "OP_DROP",
          hex: "0x75",
          description: "Removes the top stack item",
          example: "<data> OP_DROP"
        },
        {
          name: "OP_SWAP",
          hex: "0x7c",
          description: "Swaps the top two stack items",
          example: "<data1> <data2> OP_SWAP"
        },
        {
          name: "OP_OVER",
          hex: "0x78",
          description: "Copies the second-to-top stack item to the top",
          example: "<data1> <data2> OP_OVER"
        },
        {
          name: "OP_ROT",
          hex: "0x7b",
          description: "Rotates the top three stack items",
          example: "<data1> <data2> <data3> OP_ROT"
        }
      ]
    },
    flow: {
      title: "Flow Control Operations",
      description: "Control the execution flow and conditional logic in scripts",
      opcodes: [
        {
          name: "OP_IF",
          hex: "0x63",
          description: "If the top stack item is true, execute the following code until OP_ELSE or OP_ENDIF",
          example: "<condition> OP_IF <code> OP_ENDIF"
        },
        {
          name: "OP_NOTIF",
          hex: "0x64",
          description: "If the top stack item is false, execute the following code until OP_ELSE or OP_ENDIF",
          example: "<condition> OP_NOTIF <code> OP_ENDIF"
        },
        {
          name: "OP_ELSE",
          hex: "0x67",
          description: "Marks the beginning of the else block in an if statement",
          example: "<condition> OP_IF <code1> OP_ELSE <code2> OP_ENDIF"
        },
        {
          name: "OP_ENDIF",
          hex: "0x68",
          description: "Marks the end of an if statement block",
          example: "<condition> OP_IF <code> OP_ENDIF"
        },
        {
          name: "OP_VERIFY",
          hex: "0x69",
          description: "Marks transaction as invalid if top stack value is not true",
          example: "<condition> OP_VERIFY"
        },
        {
          name: "OP_RETURN",
          hex: "0x6a",
          description: "Marks transaction as invalid. Used for data storage",
          example: "OP_RETURN <data>"
        }
      ]
    },
    patterns: {
      title: "Common Script Patterns",
      description: "Frequently used BitcoinSV Script patterns and their use cases",
      examples: [
        {
          name: "Pay-to-Public-Key-Hash (P2PKH)",
          script: "OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG",
          description: "Standard Bitcoin address script. Requires a public key and signature."
        },
        {
          name: "Multi-Signature (2-of-3)",
          script: "2 <pubKey1> <pubKey2> <pubKey3> 3 OP_CHECKMULTISIG",
          description: "Requires 2 signatures from 3 possible public keys."
        },
        {
          name: "Data Storage (OP_RETURN)",
          script: "OP_RETURN <data>",
          description: "Stores arbitrary data on the blockchain. Transaction is unspendable."
        },
        {
          name: "Conditional Spending",
          script: "<condition> OP_IF\n    <pubKey1> OP_CHECKSIG\nOP_ELSE\n    <pubKey2> OP_CHECKSIG\nOP_ENDIF",
          description: "Allows spending with different keys based on a condition."
        }
      ]
    }
  };

  res.json({
    success: true,
    data: sigops,
    message: "BitcoinSV Script signature operations reference"
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

module.exports = app; 