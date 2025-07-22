/**
 * Sample API Services for BSV Micropayments Gateway
 * 
 * This file contains examples of how to configure external API services
 * that can be accessed through the BSV micropayments gateway.
 */

const sampleAPIServices = [
  {
    name: "Weather API",
    slug: "weather",
    description: "Real-time weather data for any location worldwide",
    category: "weather",
    baseUrl: "https://api.openweathermap.org/data/2.5",
    endpoints: [
      {
        name: "Current Weather",
        path: "/weather",
        method: "GET",
        description: "Get current weather conditions for a city",
        parameters: [
          { name: "q", type: "string", required: true, description: "City name", defaultValue: "" },
          { name: "units", type: "string", required: false, description: "Units (metric/imperial)", defaultValue: "metric" }
        ],
        rateLimit: { requests: 100, window: 3600 }
      },
      {
        name: "5-Day Forecast",
        path: "/forecast",
        method: "GET",
        description: "Get 5-day weather forecast",
        parameters: [
          { name: "q", type: "string", required: true, description: "City name", defaultValue: "" }
        ],
        rateLimit: { requests: 50, window: 3600 }
      }
    ],
    authentication: {
      type: "apiKey",
      location: "query",
      keyName: "appid"
    },
    pricing: {
      basePrice: 100, // 100 satoshis
      pricePerRequest: 10, // 10 satoshis per request
      freeTier: {
        requests: 10,
        window: 86400 // 24 hours
      }
    }
  },
  {
    name: "News API",
    slug: "news",
    description: "Latest news from around the world",
    category: "news",
    baseUrl: "https://newsapi.org/v2",
    endpoints: [
      {
        name: "Top Headlines",
        path: "/top-headlines",
        method: "GET",
        description: "Get top headlines by country or category",
        parameters: [
          { name: "country", type: "string", required: false, description: "Country code", defaultValue: "us" },
          { name: "category", type: "string", required: false, description: "News category", defaultValue: "" }
        ],
        rateLimit: { requests: 100, window: 3600 }
      },
      {
        name: "Everything",
        path: "/everything",
        method: "GET",
        description: "Search for news articles",
        parameters: [
          { name: "q", type: "string", required: true, description: "Search query", defaultValue: "" },
          { name: "sortBy", type: "string", required: false, description: "Sort order", defaultValue: "publishedAt" }
        ],
        rateLimit: { requests: 50, window: 3600 }
      }
    ],
    authentication: {
      type: "apiKey",
      location: "header",
      keyName: "X-API-Key"
    },
    pricing: {
      basePrice: 150,
      pricePerRequest: 15,
      freeTier: {
        requests: 5,
        window: 86400
      }
    }
  },
  {
    name: "Crypto Price API",
    slug: "crypto",
    description: "Real-time cryptocurrency prices and market data",
    category: "finance",
    baseUrl: "https://api.coingecko.com/api/v3",
    endpoints: [
      {
        name: "Current Price",
        path: "/simple/price",
        method: "GET",
        description: "Get current cryptocurrency prices",
        parameters: [
          { name: "ids", type: "string", required: true, description: "Comma-separated coin IDs", defaultValue: "bitcoin" },
          { name: "vs_currencies", type: "string", required: true, description: "Target currencies", defaultValue: "usd" }
        ],
        rateLimit: { requests: 200, window: 3600 }
      },
      {
        name: "Market Data",
        path: "/coins/markets",
        method: "GET",
        description: "Get detailed market data for cryptocurrencies",
        parameters: [
          { name: "vs_currency", type: "string", required: true, description: "Target currency", defaultValue: "usd" },
          { name: "order", type: "string", required: false, description: "Sort order", defaultValue: "market_cap_desc" }
        ],
        rateLimit: { requests: 100, window: 3600 }
      }
    ],
    authentication: {
      type: "none"
    },
    pricing: {
      basePrice: 200,
      pricePerRequest: 20,
      freeTier: {
        requests: 20,
        window: 86400
      }
    }
  },
  {
    name: "IP Geolocation API",
    slug: "geolocation",
    description: "Get location information from IP addresses",
    category: "other",
    baseUrl: "http://ip-api.com/json",
    endpoints: [
      {
        name: "IP Lookup",
        path: "",
        method: "GET",
        description: "Get geolocation data for an IP address",
        parameters: [
          { name: "query", type: "string", required: false, description: "IP address (defaults to request IP)", defaultValue: "" }
        ],
        rateLimit: { requests: 1000, window: 3600 }
      }
    ],
    authentication: {
      type: "none"
    },
    pricing: {
      basePrice: 50,
      pricePerRequest: 5,
      freeTier: {
        requests: 100,
        window: 86400
      }
    }
  }
];

module.exports = sampleAPIServices; 