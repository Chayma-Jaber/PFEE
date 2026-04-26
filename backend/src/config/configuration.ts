export default () => ({
  port: parseInt(process.env.PORT, 10) || 8000,
  environment: process.env.NODE_ENV || 'development',
  debug: process.env.DEBUG === 'true',

  database: {
    type: process.env.DB_TYPE || 'mssql',
    host: process.env.DB_HOST || 'DESKTOP-KOR5QAB',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    username: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin123',
    name: process.env.DB_NAME || 'barsha',
    url: process.env.DATABASE_URL || '',
    poolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 5,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'barsha-dev-secret-change-in-production',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    accessTokenExpireMinutes:
      parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES, 10) || 1440,
    refreshTokenExpireDays:
      parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRE_DAYS, 10) || 7,
  },

  cors: {
    origins: process.env.CORS_ORIGINS || 'http://localhost:4200',
    allowCredentials:
      process.env.CORS_ALLOW_CREDENTIALS !== 'false',
    maxAge: parseInt(process.env.CORS_MAX_AGE, 10) || 3600,
  },

  meilisearch: {
    url: process.env.MEILISEARCH_URL || 'http://localhost:7700',
    token: process.env.MEILISEARCH_TOKEN || '',
  },

  ai: {
    aiServiceUrl:
      process.env.AI_SERVICE_URL || 'http://localhost:8001',
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    modelTimeout: parseInt(process.env.AI_MODEL_TIMEOUT, 10) || 30,
    maxTokens: parseInt(process.env.AI_MAX_TOKENS, 10) || 2048,
  },

  payment: {
    ctpMerchantId: process.env.CTP_MERCHANT_ID || '',
    ctpApiKey: process.env.CTP_API_KEY || '',
    ctpSecretKey: process.env.CTP_SECRET_KEY || '',
    ctpApiUrl:
      process.env.CTP_API_URL || 'https://api.sandbox.ctp.tn',
    ctpSandboxMode: process.env.CTP_SANDBOX_MODE !== 'false',
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    smtpHost: process.env.SMTP_HOST || 'localhost',
    smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    fromEmail:
      process.env.EMAIL_FROM || 'noreply@barsha.com.tn',
    fromName: process.env.EMAIL_FROM_NAME || 'Barsha',
    enabled: process.env.EMAIL_ENABLED !== 'false',
  },

  sms: {
    // console = dev-default, logs only. twilio = real Twilio REST API. infobip = generic HTTP Basic provider.
    provider: process.env.SMS_PROVIDER || 'console',
    enabled: process.env.SMS_ENABLED === 'true',
    fromNumber: process.env.SMS_FROM || 'Barsha',
    defaultCountryCode: process.env.SMS_DEFAULT_COUNTRY_CODE || '+216', // Tunisia
    twilioAccountSid: process.env.SMS_TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.SMS_TWILIO_AUTH_TOKEN || '',
    infobipBaseUrl: process.env.SMS_INFOBIP_BASE_URL || '',
    infobipApiKey: process.env.SMS_INFOBIP_API_KEY || '',
  },

  app: {
    url: process.env.APP_URL || 'http://localhost:8000',
    frontendUrl:
      process.env.FRONTEND_URL || 'http://localhost:4200',
  },

  loyalty: {
    enabled: process.env.LOYALTY_ENABLED !== 'false',
    pointsPerDinar:
      parseInt(process.env.LOYALTY_POINTS_PER_DINAR, 10) || 10,
    redemptionRate:
      parseInt(process.env.LOYALTY_REDEMPTION_RATE, 10) || 100,
  },

  alerts: {
    enabled: process.env.ALERTS_ENABLED !== 'false',
    priceDropThreshold:
      parseInt(process.env.ALERTS_PRICE_DROP_THRESHOLD, 10) || 5,
    stockCheckInterval:
      parseInt(process.env.ALERTS_STOCK_CHECK_INTERVAL, 10) || 300,
  },

  shipping: {
    firstDelivery: {
      apiKey: process.env.FIRST_DELIVERY_API_KEY || '',
      apiUrl: process.env.FIRST_DELIVERY_API_URL || 'https://api.firstdelivery.tn/v1',
    },
    aramex: {
      accountNumber: process.env.ARAMEX_ACCOUNT_NUMBER || '',
      username: process.env.ARAMEX_USERNAME || '',
      password: process.env.ARAMEX_PASSWORD || '',
      apiUrl: process.env.ARAMEX_API_URL || 'https://ws.aramex.net/ShippingAPI.V2',
    },
  },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@barsha.com.tn',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },

  fiscal: {
    issuerMatricule: process.env.FISCAL_ISSUER_MATRICULE || '0000000A/A/M/000',
    ttnEnabled: process.env.FISCAL_TTN_ENABLED === 'true',
    ttnEndpoint: process.env.FISCAL_TTN_ENDPOINT || '',
    ttnApiKey: process.env.FISCAL_TTN_API_KEY || '',
  },
});
