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

// Individual SigOp API Endpoints

// Cryptographic Operations
app.get('/api/demo/script/op/checksig', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_CHECKSIG",
      hex: "0xac",
      description: "Verifies a signature against a public key and message hash",
      example: "OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG",
      category: "cryptographic",
      usage: "Standard signature verification in Bitcoin transactions"
    }
  });
});

app.get('/api/demo/script/op/checksigverify', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_CHECKSIGVERIFY",
      hex: "0xad",
      description: "Same as OP_CHECKSIG but fails the script if verification fails",
      example: "OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIGVERIFY",
      category: "cryptographic",
      usage: "Signature verification with automatic failure on invalid signature"
    }
  });
});

app.get('/api/demo/script/op/checkmultisig', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_CHECKMULTISIG",
      hex: "0xae",
      description: "Verifies multiple signatures against multiple public keys",
      example: "2 <pubKey1> <pubKey2> <pubKey3> 3 OP_CHECKMULTISIG",
      category: "cryptographic",
      usage: "Multi-signature transactions requiring multiple approvals"
    }
  });
});

app.get('/api/demo/script/op/checkmultisigverify', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_CHECKMULTISIGVERIFY",
      hex: "0xaf",
      description: "Same as OP_CHECKMULTISIG but fails the script if verification fails",
      example: "2 <pubKey1> <pubKey2> <pubKey3> 3 OP_CHECKMULTISIGVERIFY",
      category: "cryptographic",
      usage: "Multi-signature verification with automatic failure"
    }
  });
});

app.get('/api/demo/script/op/checkdatasig', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_CHECKDATASIG",
      hex: "0xba",
      description: "Verifies a signature against arbitrary data (BitcoinSV extension)",
      example: "<data> <signature> <publicKey> OP_CHECKDATASIG",
      category: "cryptographic",
      usage: "BitcoinSV-specific data signature verification"
    }
  });
});

app.get('/api/demo/script/op/checkdatasigverify', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_CHECKDATASIGVERIFY",
      hex: "0xbb",
      description: "Same as OP_CHECKDATASIG but fails the script if verification fails",
      example: "<data> <signature> <publicKey> OP_CHECKDATASIGVERIFY",
      category: "cryptographic",
      usage: "BitcoinSV data signature verification with automatic failure"
    }
  });
});

// Hashing Operations
app.get('/api/demo/script/op/hash160', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_HASH160",
      hex: "0xa9",
      description: "Performs RIPEMD160(SHA256(x)) on the top stack item",
      example: "<data> OP_HASH160",
      category: "hashing",
      usage: "Creates Bitcoin address hashes from public keys"
    }
  });
});

app.get('/api/demo/script/op/hash256', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_HASH256",
      hex: "0xaa",
      description: "Performs SHA256(SHA256(x)) on the top stack item",
      example: "<data> OP_HASH256",
      category: "hashing",
      usage: "Double SHA256 hashing for transaction IDs"
    }
  });
});

app.get('/api/demo/script/op/sha1', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_SHA1",
      hex: "0xa7",
      description: "Performs SHA1 on the top stack item",
      example: "<data> OP_SHA1",
      category: "hashing",
      usage: "SHA1 hashing (legacy support)"
    }
  });
});

app.get('/api/demo/script/op/sha256', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_SHA256",
      hex: "0xa8",
      description: "Performs SHA256 on the top stack item",
      example: "<data> OP_SHA256",
      category: "hashing",
      usage: "Standard SHA256 hashing"
    }
  });
});

app.get('/api/demo/script/op/ripemd160', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_RIPEMD160",
      hex: "0xa6",
      description: "Performs RIPEMD160 on the top stack item",
      example: "<data> OP_RIPEMD160",
      category: "hashing",
      usage: "RIPEMD160 hashing for Bitcoin addresses"
    }
  });
});

// Stack Operations
app.get('/api/demo/script/op/dup', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_DUP",
      hex: "0x76",
      description: "Duplicates the top stack item",
      example: "<data> OP_DUP",
      category: "stack",
      usage: "Commonly used in P2PKH scripts to duplicate public key hash"
    }
  });
});

app.get('/api/demo/script/op/drop', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_DROP",
      hex: "0x75",
      description: "Removes the top stack item",
      example: "<data> OP_DROP",
      category: "stack",
      usage: "Removes temporary data from stack"
    }
  });
});

app.get('/api/demo/script/op/swap', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_SWAP",
      hex: "0x7c",
      description: "Swaps the top two stack items",
      example: "<data1> <data2> OP_SWAP",
      category: "stack",
      usage: "Reorders stack items for operations"
    }
  });
});

app.get('/api/demo/script/op/over', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_OVER",
      hex: "0x78",
      description: "Copies the second-to-top stack item to the top",
      example: "<data1> <data2> OP_OVER",
      category: "stack",
      usage: "Duplicates second stack item without removing it"
    }
  });
});

app.get('/api/demo/script/op/rot', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_ROT",
      hex: "0x7b",
      description: "Rotates the top three stack items",
      example: "<data1> <data2> <data3> OP_ROT",
      category: "stack",
      usage: "Rotates three stack items (moves top to bottom)"
    }
  });
});

app.get('/api/demo/script/op/2dup', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_2DUP",
      hex: "0x6e",
      description: "Duplicates the top two stack items",
      example: "<data1> <data2> OP_2DUP",
      category: "stack",
      usage: "Duplicates two stack items at once"
    }
  });
});

app.get('/api/demo/script/op/2drop', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_2DROP",
      hex: "0x6d",
      description: "Removes the top two stack items",
      example: "<data1> <data2> OP_2DROP",
      category: "stack",
      usage: "Removes two stack items at once"
    }
  });
});

app.get('/api/demo/script/op/2swap', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_2SWAP",
      hex: "0x72",
      description: "Swaps the top two pairs of stack items",
      example: "<data1> <data2> <data3> <data4> OP_2SWAP",
      category: "stack",
      usage: "Swaps two pairs of stack items"
    }
  });
});

app.get('/api/demo/script/op/3dup', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_3DUP",
      hex: "0x6f",
      description: "Duplicates the top three stack items",
      example: "<data1> <data2> <data3> OP_3DUP",
      category: "stack",
      usage: "Duplicates three stack items at once"
    }
  });
});

app.get('/api/demo/script/op/depth', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_DEPTH",
      hex: "0x74",
      description: "Pushes the number of stack items onto the stack",
      example: "OP_DEPTH",
      category: "stack",
      usage: "Gets current stack depth for conditional logic"
    }
  });
});

// Flow Control Operations
app.get('/api/demo/script/op/if', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_IF",
      hex: "0x63",
      description: "If the top stack item is true, execute the following code until OP_ELSE or OP_ENDIF",
      example: "<condition> OP_IF <code> OP_ENDIF",
      category: "flow",
      usage: "Conditional execution in Bitcoin Script"
    }
  });
});

app.get('/api/demo/script/op/notif', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_NOTIF",
      hex: "0x64",
      description: "If the top stack item is false, execute the following code until OP_ELSE or OP_ENDIF",
      example: "<condition> OP_NOTIF <code> OP_ENDIF",
      category: "flow",
      usage: "Inverted conditional execution"
    }
  });
});

app.get('/api/demo/script/op/else', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_ELSE",
      hex: "0x67",
      description: "Marks the beginning of the else block in an if statement",
      example: "<condition> OP_IF <code1> OP_ELSE <code2> OP_ENDIF",
      category: "flow",
      usage: "Alternative execution path in conditional statements"
    }
  });
});

app.get('/api/demo/script/op/endif', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_ENDIF",
      hex: "0x68",
      description: "Marks the end of an if statement block",
      example: "<condition> OP_IF <code> OP_ENDIF",
      category: "flow",
      usage: "Terminates conditional execution blocks"
    }
  });
});

app.get('/api/demo/script/op/verify', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_VERIFY",
      hex: "0x69",
      description: "Marks transaction as invalid if top stack value is not true",
      example: "<condition> OP_VERIFY",
      category: "flow",
      usage: "Terminates script execution if condition is false"
    }
  });
});

app.get('/api/demo/script/op/return', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_RETURN",
      hex: "0x6a",
      description: "Marks transaction as invalid. Used for data storage",
      example: "OP_RETURN <data>",
      category: "flow",
      usage: "Data storage on blockchain (transaction becomes unspendable)"
    }
  });
});

// Data Operations - Comparison
app.get('/api/demo/script/op/equal', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_EQUAL",
      hex: "0x87",
      description: "Returns true if the inputs are exactly equal, false otherwise",
      example: "<data1> <data2> OP_EQUAL",
      category: "comparison",
      usage: "Compares two values for equality"
    }
  });
});

app.get('/api/demo/script/op/equalverify', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_EQUALVERIFY",
      hex: "0x88",
      description: "Same as OP_EQUAL but runs OP_VERIFY afterward",
      example: "<data1> <data2> OP_EQUALVERIFY",
      category: "comparison",
      usage: "Equality check with automatic verification failure"
    }
  });
});

// Data Operations - Arithmetic
app.get('/api/demo/script/op/1add', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_1ADD",
      hex: "0x8b",
      description: "1 is added to the input",
      example: "<number> OP_1ADD",
      category: "arithmetic",
      usage: "Increments a number by 1"
    }
  });
});

app.get('/api/demo/script/op/1sub', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_1SUB",
      hex: "0x8c",
      description: "1 is subtracted from the input",
      example: "<number> OP_1SUB",
      category: "arithmetic",
      usage: "Decrements a number by 1"
    }
  });
});

app.get('/api/demo/script/op/negate', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_NEGATE",
      hex: "0x8f",
      description: "The sign of the input is flipped",
      example: "<number> OP_NEGATE",
      category: "arithmetic",
      usage: "Changes positive to negative or vice versa"
    }
  });
});

app.get('/api/demo/script/op/abs', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_ABS",
      hex: "0x90",
      description: "The input is made positive",
      example: "<number> OP_ABS",
      category: "arithmetic",
      usage: "Returns absolute value of a number"
    }
  });
});

// Data Operations - Boolean
app.get('/api/demo/script/op/not', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_NOT",
      hex: "0x91",
      description: "If the input is 0 or 1, it is flipped. Otherwise the output will be 0",
      example: "<boolean> OP_NOT",
      category: "boolean",
      usage: "Logical NOT operation"
    }
  });
});

app.get('/api/demo/script/op/0notequal', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_0NOTEQUAL",
      hex: "0x92",
      description: "Returns 0 if the input is 0. 1 otherwise",
      example: "<number> OP_0NOTEQUAL",
      category: "boolean",
      usage: "Converts any non-zero value to 1"
    }
  });
});

app.get('/api/demo/script/op/booland', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_BOOLAND",
      hex: "0x9a",
      description: "If both a and b are not 0, the output is 1. Otherwise 0",
      example: "<a> <b> OP_BOOLAND",
      category: "boolean",
      usage: "Logical AND operation"
    }
  });
});

app.get('/api/demo/script/op/boolor', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_BOOLOR",
      hex: "0x9b",
      description: "If a or b is not 0, the output is 1. Otherwise 0",
      example: "<a> <b> OP_BOOLOR",
      category: "boolean",
      usage: "Logical OR operation"
    }
  });
});

// Data Operations - Numeric Comparison
app.get('/api/demo/script/op/numequal', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_NUMEQUAL",
      hex: "0x9c",
      description: "Returns 1 if the numbers are equal, 0 otherwise",
      example: "<num1> <num2> OP_NUMEQUAL",
      category: "numeric",
      usage: "Numeric equality comparison"
    }
  });
});

app.get('/api/demo/script/op/numequalverify', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_NUMEQUALVERIFY",
      hex: "0x9d",
      description: "Same as OP_NUMEQUAL but runs OP_VERIFY afterward",
      example: "<num1> <num2> OP_NUMEQUALVERIFY",
      category: "numeric",
      usage: "Numeric equality with automatic verification"
    }
  });
});

app.get('/api/demo/script/op/numnotequal', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_NUMNOTEQUAL",
      hex: "0x9e",
      description: "Returns 1 if the numbers are not equal, 0 otherwise",
      example: "<num1> <num2> OP_NUMNOTEQUAL",
      category: "numeric",
      usage: "Numeric inequality comparison"
    }
  });
});

app.get('/api/demo/script/op/lessthan', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_LESSTHAN",
      hex: "0x9f",
      description: "Returns 1 if a is less than b, 0 otherwise",
      example: "<a> <b> OP_LESSTHAN",
      category: "numeric",
      usage: "Less than comparison"
    }
  });
});

app.get('/api/demo/script/op/greaterthan', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_GREATERTHAN",
      hex: "0xa0",
      description: "Returns 1 if a is greater than b, 0 otherwise",
      example: "<a> <b> OP_GREATERTHAN",
      category: "numeric",
      usage: "Greater than comparison"
    }
  });
});

app.get('/api/demo/script/op/lessthanorequal', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_LESSTHANOREQUAL",
      hex: "0xa1",
      description: "Returns 1 if a is less than or equal to b, 0 otherwise",
      example: "<a> <b> OP_LESSTHANOREQUAL",
      category: "numeric",
      usage: "Less than or equal comparison"
    }
  });
});

app.get('/api/demo/script/op/greaterthanorequal', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_GREATERTHANOREQUAL",
      hex: "0xa2",
      description: "Returns 1 if a is greater than or equal to b, 0 otherwise",
      example: "<a> <b> OP_GREATERTHANOREQUAL",
      category: "numeric",
      usage: "Greater than or equal comparison"
    }
  });
});

app.get('/api/demo/script/op/min', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_MIN",
      hex: "0xa3",
      description: "Returns the smaller of a and b",
      example: "<a> <b> OP_MIN",
      category: "numeric",
      usage: "Returns minimum of two values"
    }
  });
});

app.get('/api/demo/script/op/max', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "OP_MAX",
      hex: "0xa4",
      description: "Returns the larger of a and b",
      example: "<a> <b> OP_MAX",
      category: "numeric",
      usage: "Returns maximum of two values"
    }
  });
});

// Script Pattern Endpoints
app.get('/api/demo/script/pattern/p2pkh', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "Pay-to-Public-Key-Hash (P2PKH)",
      script: "OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG",
      description: "Standard Bitcoin address script. Requires a public key and signature.",
      category: "pattern",
      usage: "Most common Bitcoin transaction type"
    }
  });
});

app.get('/api/demo/script/pattern/multisig', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "Multi-Signature (2-of-3)",
      script: "2 <pubKey1> <pubKey2> <pubKey3> 3 OP_CHECKMULTISIG",
      description: "Requires 2 signatures from 3 possible public keys.",
      category: "pattern",
      usage: "Multi-party transactions requiring multiple approvals"
    }
  });
});

app.get('/api/demo/script/pattern/opreturn', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "Data Storage (OP_RETURN)",
      script: "OP_RETURN <data>",
      description: "Stores arbitrary data on the blockchain. Transaction is unspendable.",
      category: "pattern",
      usage: "Data storage and metadata on blockchain"
    }
  });
});

app.get('/api/demo/script/pattern/conditional', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "Conditional Spending",
      script: "<condition> OP_IF\n    <pubKey1> OP_CHECKSIG\nOP_ELSE\n    <pubKey2> OP_CHECKSIG\nOP_ENDIF",
      description: "Allows spending with different keys based on a condition.",
      category: "pattern",
      usage: "Complex spending conditions and smart contracts"
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

module.exports = app; 