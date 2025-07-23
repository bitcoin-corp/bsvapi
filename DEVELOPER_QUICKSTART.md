# 🚀 BSV API Platform - Developer Quick Start Guide

Welcome to BSV API Platform! This guide will help you get started with using APIs that accept BitcoinSV micropayments.

## 🎯 **What is BSV API Platform?**

BSV API Platform is a marketplace where you can access paid APIs using BitcoinSV micropayments. The platform:

- **Converts BSV to stablecoins** immediately upon payment
- **Pays suppliers** via traditional methods (Stripe, PayPal, bank transfer)
- **Handles all the complexity** of micropayments and currency conversion
- **Provides a unified interface** for accessing multiple APIs

---

## 📋 **Prerequisites**

- **BitcoinSV wallet** with some BSV for payments
- **Basic understanding** of REST APIs
- **JavaScript knowledge** (for SDK examples)

---

## 🚀 **Quick Start (5 Minutes)**

### **Step 1: Register as a Developer**

```bash
curl -X POST https://bsvapi.com/api/developer/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "secure-password",
    "name": "Your Name"
  }'
```

### **Step 2: Create an API Key**

```bash
curl -X POST https://bsvapi.com/api/developer/keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key",
    "permissions": ["read", "write"]
  }'
```

### **Step 3: Add BSV to Your Balance**

```bash
curl -X POST https://bsvapi.com/api/developer/topup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 0.001,
    "paymentMethod": "bsv_wallet"
  }'
```

### **Step 4: Browse Available APIs**

```bash
curl -X GET https://bsvapi.com/api/apis/marketplace \
  -H "X-API-Key: YOUR_API_KEY"
```

### **Step 5: Make Your First API Call**

```bash
curl -X POST https://bsvapi.com/api/apis/call \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "weather-api-service-id",
    "endpoint": "/weather/current",
    "parameters": {
      "city": "London"
    }
  }'
```

---

## 💰 **Understanding Payments**

### **How Payments Work:**

1. **You pay in BSV** - Each API call costs a small amount of BSV
2. **Platform converts to USD** - BSV is immediately converted to stablecoins
3. **Supplier gets paid** - Supplier receives payment via Stripe/PayPal/bank transfer
4. **No exchange risk** - Suppliers get stable payments in their preferred currency

### **Example Payment Flow:**

```
API Call Cost: 0.0001 BSV (~$0.10)
Platform Fee: 10% ($0.01)
Supplier Receives: $0.09 via Stripe/PayPal
```

### **Checking Your Balance:**

```bash
curl -X GET https://bsvapi.com/api/developer/balance \
  -H "X-API-Key: YOUR_API_KEY"
```

Response:
```json
{
  "balance": 0.005,
  "currency": "BSV",
  "usdValue": 5.00,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

---

## 🔍 **Finding APIs**

### **Browse by Category:**

```bash
# Get all data APIs
curl "https://bsvapi.com/api/apis/marketplace?category=data"

# Get all AI APIs
curl "https://bsvapi.com/api/apis/marketplace?category=ai"

# Get all finance APIs
curl "https://bsvapi.com/api/apis/marketplace?category=finance"
```

### **Search and Filter:**

```bash
# Search by name
curl "https://bsvapi.com/api/apis/marketplace?search=weather"

# Sort by price (lowest first)
curl "https://bsvapi.com/api/apis/marketplace?sort=price_asc"

# Sort by popularity
curl "https://bsvapi.com/api/apis/marketplace?sort=popular"

# Filter by price range
curl "https://bsvapi.com/api/apis/marketplace?minPrice=0.001&maxPrice=0.01"
```

### **Get API Details:**

```bash
curl -X GET https://bsvapi.com/api/apis/API_SERVICE_ID \
  -H "X-API-Key: YOUR_API_KEY"
```

Response:
```json
{
  "id": "api-service-id",
  "name": "Weather API",
  "description": "Real-time weather data for any location",
  "category": "data",
  "supplier": {
    "name": "WeatherCorp",
    "verified": true
  },
  "pricing": {
    "model": "per_call",
    "pricePerCall": 0.0001,
    "currency": "BSV"
  },
  "documentation": {
    "overview": "Get current weather conditions...",
    "endpoints": [
      {
        "path": "/weather/current",
        "method": "GET",
        "description": "Get current weather for a city"
      }
    ]
  }
}
```

---

## 📞 **Making API Calls**

### **Basic API Call:**

```bash
curl -X POST https://bsvapi.com/api/apis/call \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "weather-api-service-id",
    "endpoint": "/weather/current",
    "parameters": {
      "city": "London",
      "units": "metric"
    }
  }'
```

### **API Call with Headers:**

```bash
curl -X POST https://bsvapi.com/api/apis/call \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "api-service-id",
    "endpoint": "/data/process",
    "method": "POST",
    "parameters": {
      "data": "your-data-here"
    },
    "headers": {
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  }'
```

### **Response Format:**

```json
{
  "success": true,
  "data": {
    "temperature": 22,
    "condition": "sunny",
    "humidity": 65
  },
  "payment": {
    "amount": 0.0001,
    "currency": "BSV",
    "usdValue": 0.10,
    "transactionId": "tx_123456789"
  },
  "usage": {
    "remainingBalance": 0.0049,
    "callsThisMonth": 15
  }
}
```

---

## ⚠️ **Handling Insufficient Balance**

### **Check Balance Before Call:**

```bash
curl -X GET https://bsvapi.com/api/developer/balance \
  -H "X-API-Key: YOUR_API_KEY"
```

### **Add More BSV:**

```bash
curl -X POST https://bsvapi.com/api/developer/topup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 0.01,
    "paymentMethod": "bsv_wallet"
  }'
```

### **Error Response (Insufficient Balance):**

```json
{
  "success": false,
  "error": "insufficient_balance",
  "message": "Insufficient BSV balance for this API call",
  "required": 0.0001,
  "available": 0.00005,
  "topupUrl": "https://bsvapi.com/developer/topup"
}
```

---

## 📊 **Usage Tracking**

### **Get Usage Statistics:**

```bash
curl -X GET https://bsvapi.com/api/developer/usage \
  -H "X-API-Key: YOUR_API_KEY"
```

Response:
```json
{
  "totalCalls": 150,
  "totalSpent": 0.015,
  "totalSpentUSD": 15.00,
  "thisMonth": {
    "calls": 45,
    "spent": 0.0045,
    "spentUSD": 4.50
  },
  "topApis": [
    {
      "serviceId": "weather-api",
      "name": "Weather API",
      "calls": 30,
      "spent": 0.003
    }
  ]
}
```

### **Get Payment History:**

```bash
curl -X GET https://bsvapi.com/api/developer/payments \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## 🔧 **SDK Examples**

### **JavaScript SDK:**

```javascript
import { BSVAPI } from '@bsvapi/sdk';

const api = new BSVAPI({
  apiKey: 'your-api-key'
});

// Make an API call
const response = await api.call({
  serviceId: 'weather-api-service-id',
  endpoint: '/weather/current',
  parameters: {
    city: 'London'
  }
});

console.log(response.data);
console.log(`Paid: ${response.payment.amount} BSV`);
```

### **Python SDK:**

```python
from bsvapi import BSVAPI

api = BSVAPI(api_key='your-api-key')

# Make an API call
response = api.call(
    service_id='weather-api-service-id',
    endpoint='/weather/current',
    parameters={'city': 'London'}
)

print(response.data)
print(f"Paid: {response.payment.amount} BSV")
```

### **Go SDK:**

```go
package main

import (
    "github.com/bsvapi/go-sdk"
)

func main() {
    api := bsvapi.New("your-api-key")
    
    response, err := api.Call(bsvapi.CallRequest{
        ServiceID:  "weather-api-service-id",
        Endpoint:   "/weather/current",
        Parameters: map[string]interface{}{"city": "London"},
    })
    
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Temperature: %v\n", response.Data["temperature"])
    fmt.Printf("Paid: %v BSV\n", response.Payment.Amount)
}
```

---

## 🔐 **Security Best Practices**

### **API Key Security:**

1. **Keep your API key secret** - Never expose it in client-side code
2. **Use environment variables** - Store keys in `.env` files
3. **Rotate keys regularly** - Create new keys and delete old ones
4. **Monitor usage** - Check for unexpected API calls

### **Example Environment Setup:**

```bash
# .env file
BSVAPI_API_KEY=your-api-key-here
BSVAPI_BASE_URL=https://bsvapi.com
```

### **Secure API Key Usage:**

```javascript
// ✅ Good - Use environment variables
const apiKey = process.env.BSVAPI_API_KEY;

// ❌ Bad - Hardcoded in code
const apiKey = 'your-api-key-here';
```

---

## 💡 **Pricing & Costs**

### **Typical API Costs:**

- **Data APIs**: 0.0001 - 0.001 BSV per call (~$0.10 - $1.00)
- **AI APIs**: 0.001 - 0.01 BSV per call (~$1.00 - $10.00)
- **Finance APIs**: 0.0005 - 0.005 BSV per call (~$0.50 - $5.00)

### **Platform Fee:**

- **10% platform fee** on all API calls
- **90% goes to suppliers** via traditional payments
- **No hidden fees** - all costs are transparent

### **Cost Optimization:**

1. **Batch requests** when possible
2. **Use caching** to avoid repeated calls
3. **Monitor usage** to identify expensive APIs
4. **Consider subscriptions** for high-volume usage

---

## 🆘 **Troubleshooting**

### **Common Issues:**

#### **1. Insufficient Balance**
```json
{
  "error": "insufficient_balance",
  "solution": "Add more BSV to your account"
}
```

#### **2. Invalid API Key**
```json
{
  "error": "invalid_api_key",
  "solution": "Check your API key or create a new one"
}
```

#### **3. Rate Limited**
```json
{
  "error": "rate_limit_exceeded",
  "solution": "Wait before making more requests"
}
```

#### **4. API Service Unavailable**
```json
{
  "error": "service_unavailable",
  "solution": "Try again later or contact support"
}
```

### **Getting Help:**

- **Documentation**: https://docs.bsvapi.com
- **Support Email**: support@bsvapi.com
- **Community**: https://community.bsvapi.com
- **Status Page**: https://status.bsvapi.com

---

## 🎉 **Next Steps**

### **Explore the Marketplace:**
1. Browse available APIs by category
2. Read API documentation
3. Test APIs with small amounts
4. Integrate into your applications

### **Advanced Features:**
1. **Webhooks** - Get notified of payment events
2. **Bulk Operations** - Process multiple API calls
3. **Analytics** - Track usage patterns
4. **Team Management** - Share API keys with team

### **Stay Updated:**
- Follow our blog for new APIs
- Join our developer community
- Subscribe to our newsletter
- Follow us on social media

---

## 📞 **Support**

Need help? We're here to assist you:

- **Email**: support@bsvapi.com
- **Documentation**: https://docs.bsvapi.com
- **Community**: https://community.bsvapi.com
- **Status**: https://status.bsvapi.com

**Happy coding with BSV micropayments! 🚀** 