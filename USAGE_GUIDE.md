# BSV Micropayments API - Usage Guide

This guide demonstrates how to use the BSV Micropayments API to access external APIs through micropayments.

## 🚀 Quick Start

### 1. Start the Application

```bash
# Development mode
npm run dev

# Or use the startup script
node start-dev.js
```

### 2. Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "username": "testuser",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

Response:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "username": "testuser",
      "apiKey": "bsv_user_id_abc123",
      "bsvAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "balance": 0
    },
    "token": "jwt_token_here"
  }
}
```

### 3. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

## 💰 BSV Micropayments

### 1. Add Balance (Deposit)

```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "description": "Account deposit",
    "type": "deposit"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_1234567890_abc123",
    "amount": 10000,
    "totalAmount": 11000,
    "minerFee": 1000,
    "serviceFee": 0,
    "status": "pending",
    "bsvAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "network": "testnet"
  }
}
```

### 2. Process Payment

Send BSV to the provided address and then process the payment:

```bash
curl -X POST http://localhost:3000/api/payments/process \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "pay_1234567890_abc123",
    "txHex": "BSV_TRANSACTION_HEX_HERE"
  }'
```

### 3. Check Balance

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/users/me
```

## 🔌 Using External APIs

### 1. Browse Available APIs

```bash
curl http://localhost:3000/api/apis/services
```

### 2. Get API Details

```bash
curl http://localhost:3000/api/apis/services/weather
```

### 3. Make API Calls

#### Using JWT Token:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/apis/proxy/weather/current?q=London&units=metric"
```

#### Using API Key:
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:3000/api/apis/proxy/weather/current?q=London&units=metric"
```

### 4. API Call with Micropayment

If you don't have sufficient balance, the API will create a micropayment request:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/apis/proxy/news/top-headlines?country=us"
```

Response (if insufficient balance):
```json
{
  "error": "Insufficient balance",
  "message": "Payment required to access this API",
  "data": {
    "requiredAmount": 165,
    "currentBalance": 100,
    "paymentRequest": {
      "paymentId": "pay_1234567890_def456",
      "amount": 165,
      "description": "API call to News API - Top Headlines"
    }
  }
}
```

## 📊 Admin Functions

### 1. View All Users (Admin Only)

```bash
curl -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  http://localhost:3000/api/admin/users
```

### 2. View Payment Statistics

```bash
curl -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  http://localhost:3000/api/admin/statistics
```

### 3. Add API Service (Admin Only)

```bash
curl -X POST http://localhost:3000/api/admin/apis \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weather API",
    "slug": "weather",
    "description": "Real-time weather data",
    "category": "weather",
    "baseUrl": "https://api.openweathermap.org/data/2.5",
    "endpoints": [
      {
        "name": "Current Weather",
        "path": "/weather",
        "method": "GET",
        "parameters": [
          {
            "name": "q",
            "type": "string",
            "required": true,
            "description": "City name"
          }
        ]
      }
    ],
    "authentication": {
      "type": "apiKey",
      "location": "query",
      "keyName": "appid"
    },
    "pricing": {
      "basePrice": 100,
      "pricePerRequest": 10
    }
  }'
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/bsvapi

# Redis Configuration (optional for development)
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# BSV Configuration
BSV_NETWORK=testnet
BSV_MINER_FEE=1000
BSV_SERVICE_FEE=0.01

# Webhook Configuration
WEBHOOK_SECRET=your-webhook-secret-key

# Logging Configuration
LOG_LEVEL=info
```

## 🧪 Testing

### 1. Health Check

```bash
curl http://localhost:3000/health
```

### 2. API Documentation

Visit: http://localhost:3000/api-docs

### 3. Run Tests

```bash
npm test
```

## 📈 Monitoring

### 1. User Dashboard

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/users/dashboard
```

### 2. Payment History

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/payments/history
```

### 3. API Usage Statistics

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/apis/usage
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **API Key Management**: Unique API keys for each user
- **Rate Limiting**: Redis-based rate limiting (falls back to memory)
- **Input Validation**: Joi schema validation
- **Security Headers**: Helmet.js for security headers
- **CORS Protection**: Configurable CORS settings
- **Password Hashing**: bcrypt password hashing
- **Account Locking**: Automatic account locking after failed attempts

## 🚀 Production Deployment

### 1. Docker Deployment

```bash
# Build image
docker build -t bsvapi .

# Run container
docker run -p 3000:3000 --env-file .env bsvapi
```

### 2. Docker Compose

```bash
docker-compose up -d
```

### 3. Environment Setup

- Set `NODE_ENV=production`
- Use strong JWT secret
- Configure MongoDB with authentication
- Set up Redis with authentication
- Configure CORS origins
- Set up SSL/TLS certificates

## 🤝 Integration Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class BSVAPIClient {
  constructor(baseURL, apiKey) {
    this.client = axios.create({
      baseURL,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  async getWeather(city) {
    try {
      const response = await this.client.get(`/api/apis/proxy/weather/current?q=${city}`);
      return response.data;
    } catch (error) {
      if (error.response?.data?.error === 'Insufficient balance') {
        // Handle micropayment request
        const paymentRequest = error.response.data.data.paymentRequest;
        console.log('Payment required:', paymentRequest);
        // Process payment and retry
      }
      throw error;
    }
  }

  async createPayment(amount, description) {
    const response = await this.client.post('/api/payments/create', {
      amount,
      description,
      type: 'deposit'
    });
    return response.data;
  }
}

// Usage
const client = new BSVAPIClient('http://localhost:3000', 'your-api-key');
const weather = await client.getWeather('London');
```

### Python

```python
import requests

class BSVAPIClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        }
    
    def get_weather(self, city):
        try:
            response = requests.get(
                f"{self.base_url}/api/apis/proxy/weather/current",
                params={'q': city},
                headers=self.headers
            )
            return response.json()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 402:
                # Handle micropayment request
                data = e.response.json()
                payment_request = data['data']['paymentRequest']
                print(f"Payment required: {payment_request}")
                # Process payment and retry
            raise e
    
    def create_payment(self, amount, description):
        response = requests.post(
            f"{self.base_url}/api/payments/create",
            json={
                'amount': amount,
                'description': description,
                'type': 'deposit'
            },
            headers=self.headers
        )
        return response.json()

# Usage
client = BSVAPIClient('http://localhost:3000', 'your-api-key')
weather = client.get_weather('London')
```

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Email: support@bsvapi.com
- Documentation: http://localhost:3000/api-docs 