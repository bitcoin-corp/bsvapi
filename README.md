# BSV Micropayments API

A comprehensive API gateway for BSV (Bitcoin SV) micropayments that connects to multiple external APIs and sells access via micropayments.

## 🚀 Features

- **BSV Micropayments**: Complete BSV payment processing with transaction validation
- **API Gateway**: Proxy and manage multiple external APIs
- **User Management**: Full user authentication and profile management
- **Micropayment Channels**: Efficient micropayment processing
- **Rate Limiting**: Advanced rate limiting with Redis
- **Admin Dashboard**: Comprehensive admin interface for monitoring
- **API Documentation**: Auto-generated Swagger documentation
- **Security**: JWT authentication, API key management, and security headers

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Web Apps      │    │   Mobile Apps   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    BSV API Gateway        │
                    │  (Express.js + Node.js)   │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────▼─────────┐  ┌─────────▼─────────┐  ┌─────────▼─────────┐
│   MongoDB         │  │   Redis           │  │   External APIs   │
│   (User Data)     │  │   (Caching)       │  │   (Weather, News, │
│   (Payments)      │  │   (Rate Limiting) │  │    Finance, etc.) │
│   (API Services)  │  │                   │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 5+
- Redis 6+
- BSV node (optional, for mainnet)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bsvapi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB and Redis**
   ```bash
   # MongoDB
   mongod
   
   # Redis
   redis-server
   ```

5. **Run the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/bsvapi` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | Required |
| `BSV_NETWORK` | BSV network (testnet/mainnet) | `testnet` |
| `BSV_MINER_FEE` | Miner fee in satoshis | `1000` |
| `BSV_SERVICE_FEE` | Service fee percentage | `0.01` |

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: `http://localhost:3000/api-docs`
- **API Spec**: `http://localhost:3000/api-docs.json`

## 🔐 Authentication

The API supports two authentication methods:

### JWT Authentication
```bash
curl -H "Authorization: Bearer <jwt-token>" \
     http://localhost:3000/api/auth/me
```

### API Key Authentication
```bash
curl -H "X-API-Key: <api-key>" \
     http://localhost:3000/api/apis/services
```

## 💰 BSV Micropayments

### Creating a Payment
```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "description": "API call payment",
    "type": "api_call"
  }'
```

### Processing a Payment
```bash
curl -X POST http://localhost:3000/api/payments/process \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "pay_1234567890_abc123",
    "txHex": "<bsv-transaction-hex>"
  }'
```

## 🔌 API Proxy

### Making API Calls
```bash
curl -H "X-API-Key: <api-key>" \
     "http://localhost:3000/api/apis/proxy/weather/current?city=London"
```

## 👥 User Management

### Registration
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'
```

## 🏗️ Project Structure

```
src/
├── config/           # Configuration files
│   ├── database.js   # MongoDB configuration
│   ├── redis.js      # Redis configuration
│   └── swagger.js    # Swagger documentation
├── middleware/       # Express middleware
│   ├── auth.js       # Authentication middleware
│   └── rateLimiter.js # Rate limiting middleware
├── models/           # Database models
│   ├── User.js       # User model
│   ├── APIService.js # API service model
│   └── Payment.js    # Payment model
├── routes/           # API routes
│   ├── auth.js       # Authentication routes
│   ├── payments.js   # Payment routes
│   ├── apis.js       # API proxy routes
│   ├── users.js      # User management routes
│   └── admin.js      # Admin routes
├── utils/            # Utility functions
│   ├── logger.js     # Winston logger
│   └── bsv.js        # BSV utilities
└── index.js          # Main application file
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Admin Dashboard
Access admin dashboard at `/api/admin/dashboard` (requires admin role)

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **API Key Management**: Unique API keys for each user
- **Rate Limiting**: Redis-based rate limiting
- **Input Validation**: Joi schema validation
- **Security Headers**: Helmet.js for security headers
- **CORS Protection**: Configurable CORS settings
- **Password Hashing**: bcrypt password hashing
- **Account Locking**: Automatic account locking after failed attempts

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t bsvapi .

# Run container
docker run -p 3000:3000 --env-file .env bsvapi
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secret
- [ ] Configure MongoDB with authentication
- [ ] Set up Redis with authentication
- [ ] Configure CORS origins
- [ ] Set up SSL/TLS certificates
- [ ] Configure logging
- [ ] Set up monitoring
- [ ] Configure backup strategy

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Email: support@bsvapi.com
- Documentation: [API Docs](http://localhost:3000/api-docs)

## 🔮 Roadmap

- [ ] WebSocket support for real-time updates
- [ ] GraphQL API
- [ ] Mobile SDKs
- [ ] Advanced analytics
- [ ] Multi-currency support
- [ ] Automated API discovery
- [ ] Machine learning for fraud detection
- [ ] Advanced caching strategies
- [ ] Microservices architecture
- [ ] Kubernetes deployment 