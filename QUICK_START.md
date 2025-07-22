# 🚀 BSV Micropayments API - Quick Start Guide

## ✅ **API is Ready to Use!**

Your BSV Micropayments API is now running successfully in demo mode. No external dependencies (MongoDB/Redis) required!

### 🌐 **Web Dashboard Available!**

You can now access a beautiful web interface at: **http://localhost:3000/**

## 🎯 **Available Endpoints**

### Health Check
```bash
curl http://localhost:3000/health
```

### BSV Operations
```bash
# Generate BSV address
curl -X POST http://localhost:3000/api/demo/bsv/generate-address

# Create payment request
curl -X POST http://localhost:3000/api/demo/bsv/create-payment-request \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "description": "Test payment"}'

# Get network info
curl http://localhost:3000/api/demo/bsv/network-info
```

### Demo API Proxies
```bash
# Weather data
curl http://localhost:3000/api/demo/proxy/weather/London

# Crypto prices
curl http://localhost:3000/api/demo/proxy/crypto/BTC
```

### Payment Simulation
```bash
curl -X POST http://localhost:3000/api/demo/payments/simulate \
  -H "Content-Type: application/json" \
  -d '{"amount": 500, "description": "Demo payment"}'
```

## 🛠 **Running the API**

### Demo Mode (Recommended for Testing)
```bash
npm run demo
```

### Full Mode (Requires MongoDB & Redis)
```bash
# Start MongoDB and Redis first, then:
npm start
```

### Development Mode
```bash
npm run dev
```

## 📋 **What's Working**

- ✅ BSV address generation
- ✅ Payment request creation
- ✅ Network information
- ✅ Demo API proxies (weather, crypto)
- ✅ Payment simulation
- ✅ Health monitoring
- ✅ Rate limiting (memory-based in demo mode)
- ✅ Error handling
- ✅ Logging

## 🔧 **Configuration**

The API uses environment variables. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key settings:
- `BSV_NETWORK=testnet` (or `mainnet`)
- `BSV_MINER_FEE=1000`
- `BSV_SERVICE_FEE=0.01`

## 📚 **Next Steps**

1. **Test the endpoints** using the curl commands above
2. **Review the full documentation** in `USAGE_GUIDE.md`
3. **Set up MongoDB & Redis** for full functionality
4. **Configure real API services** in `examples/sample-api-services.js`
5. **Deploy to production** using Docker

## 🎉 **Success!**

Your BSV Micropayments API is ready for development and testing! 