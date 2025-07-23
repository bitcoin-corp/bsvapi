# 🚀 Developer Quick Start Guide - BSVAPI.com

## 🎯 **What You Can Do**

As a developer, you can:
- **Browse APIs** in the marketplace
- **Make API calls** with automatic BSV micropayments
- **Manage your balance** and payment history
- **Get API keys** for programmatic access

## 📋 **Prerequisites**

1. **BSV Wallet**: You need a BitcoinSV wallet with some BSV
2. **Account**: Register on BSVAPI.com
3. **API Key**: Create an API key for programmatic access

## 🔧 **Step-by-Step Setup**

### 1. **Register Account**
```bash
curl -X POST https://api.bsvapi.com/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "securepassword",
    "username": "yourusername"
  }'
```

### 2. **Login & Get JWT Token**
```bash
curl -X POST https://api.bsvapi.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "securepassword"
  }'
```

### 3. **Create API Key**
```bash
curl -X POST https://api.bsvapi.com/v1/developer/keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App API Key",
    "description": "For production application"
  }'
```

### 4. **Add BSV Balance**
```bash
curl -X POST https://api.bsvapi.com/v1/payments/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "description": "Add balance for API calls"
  }'
```

## 🔍 **Browse Available APIs**

### Get All APIs
```bash
curl -X GET https://api.bsvapi.com/v1/apis/marketplace \
  -H "X-API-Key: YOUR_API_KEY"
```

### Filter by Category
```bash
curl -X GET "https://api.bsvapi.com/v1/apis/marketplace?category=data&sort=popular" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Search APIs
```bash
curl -X GET "https://api.bsvapi.com/v1/apis/marketplace?search=weather&minPrice=50&maxPrice=200" \
  -H "X-API-Key: YOUR_API_KEY"
```

## 📞 **Make API Calls**

### Simple GET Request
```bash
curl -X POST https://api.bsvapi.com/v1/apis/call \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "api_service_id_here",
    "endpoint": "/weather/current",
    "parameters": {
      "city": "London"
    }
  }'
```

### Response Example
```json
{
  "success": true,
  "data": {
    "city": "London",
    "temperature": 18,
    "condition": "Cloudy",
    "humidity": 65
  },
  "payment": {
    "amount": 100,
    "currency": "satoshis",
    "status": "confirmed"
  },
  "metadata": {
    "serviceId": "api_service_id",
    "serviceName": "Weather API",
    "endpoint": "/weather/current",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## 💰 **Handle Insufficient Balance**

If you don't have enough BSV balance, you'll get a 402 response:

```json
{
  "error": "Insufficient balance",
  "message": "Payment required to access this API",
  "data": {
    "paymentRequest": {
      "paymentId": "pay_1234567890_abc123",
      "paymentAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "amount": 100,
      "totalAmount": 1100,
      "fees": {
        "minerFee": 1000,
        "serviceFee": 0,
        "totalFees": 1000
      },
      "status": "pending",
      "expiresAt": "2024-01-15T11:30:00Z"
    }
  }
}
```

### Complete the Payment
1. **Send BSV** to the provided payment address
2. **Wait for confirmation** (usually 1-2 minutes)
3. **Retry your API call**

## 📊 **Check Your Usage**

### Get API Key Stats
```bash
curl -X GET https://api.bsvapi.com/v1/developer/keys/YOUR_API_KEY/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Payment History
```bash
curl -X GET https://api.bsvapi.com/v1/payments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Balance
```bash
curl -X GET https://api.bsvapi.com/v1/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 **SDK Examples**

### JavaScript/Node.js
```javascript
import { BSVAPI } from '@bsvapi/sdk';

const api = new BSVAPI({
  apiKey: 'your_api_key_here',
  environment: 'production'
});

// Browse APIs
const apis = await api.marketplace.listAPIs({
  category: 'data',
  sort: 'popular'
});

// Make API call
const result = await api.marketplace.callAPI({
  serviceId: 'weather_api_id',
  endpoint: '/current',
  parameters: { city: 'London' }
});

console.log(result.data); // API response
console.log(result.payment.amount); // Amount paid
```

### Python
```python
from bsvapi import BSVAPI

api = BSVAPI(api_key='your_api_key_here')

# Browse APIs
apis = api.marketplace.list_apis(category='data', sort='popular')

# Make API call
result = api.marketplace.call_api(
    service_id='weather_api_id',
    endpoint='/current',
    parameters={'city': 'London'}
)

print(result.data)  # API response
print(result.payment.amount)  # Amount paid
```

### cURL Examples
```bash
# Get weather data
curl -X POST https://api.bsvapi.com/v1/apis/call \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"serviceId":"weather_id","endpoint":"/current","parameters":{"city":"Tokyo"}}'

# Get crypto prices
curl -X POST https://api.bsvapi.com/v1/apis/call \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"serviceId":"crypto_id","endpoint":"/price","parameters":{"symbol":"BTC"}}'

# Translate text
curl -X POST https://api.bsvapi.com/v1/apis/call \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"serviceId":"translate_id","endpoint":"/translate","parameters":{"text":"Hello","target":"es"}}'
```

## 🔐 **Security Best Practices**

### 1. **Secure API Keys**
- Never commit API keys to version control
- Use environment variables
- Rotate keys regularly
- Set IP whitelists for production keys

### 2. **Error Handling**
```javascript
try {
  const result = await api.marketplace.callAPI({
    serviceId: 'api_id',
    endpoint: '/data',
    parameters: { param: 'value' }
  });
} catch (error) {
  if (error.response?.status === 402) {
    // Handle insufficient balance
    const paymentRequest = error.response.data.data.paymentRequest;
    console.log('Payment required:', paymentRequest);
  } else {
    console.error('API call failed:', error.message);
  }
}
```

### 3. **Rate Limiting**
- Respect rate limits (60 requests/minute by default)
- Implement exponential backoff for retries
- Monitor your usage

## 📈 **Pricing Examples**

### Common API Costs
- **Weather Data**: 50-100 satoshis per call
- **Translation**: 25-75 satoshis per call
- **Crypto Prices**: 10-50 satoshis per call
- **AI Services**: 100-500 satoshis per call

### Cost Calculation
```
1 BSV = 100,000,000 satoshis
1 satoshi ≈ $0.00001 (varies with BSV price)

Example: 100 satoshis ≈ $0.001 per API call
```

## 🆘 **Troubleshooting**

### Common Issues

#### 1. **401 Unauthorized**
- Check your API key is correct
- Verify the API key is active
- Ensure you're using the right header (`X-API-Key`)

#### 2. **402 Payment Required**
- Add more BSV to your balance
- Check the payment address and amount
- Wait for transaction confirmation

#### 3. **429 Too Many Requests**
- Reduce your request frequency
- Implement rate limiting in your code
- Check your current usage limits

#### 4. **500 Internal Server Error**
- Retry the request
- Check the API service status
- Contact support if persistent

### Support Resources
- **Documentation**: https://docs.bsvapi.com
- **API Status**: https://status.bsvapi.com
- **Support**: support@bsvapi.com
- **Discord**: https://discord.gg/bsvapi

## 🎉 **You're Ready!**

You now have everything you need to:
- ✅ Browse and discover APIs
- ✅ Make micropayments for API access
- ✅ Handle payments and balance management
- ✅ Use SDKs for easy integration

**Start building with BSV micropayments today!** 