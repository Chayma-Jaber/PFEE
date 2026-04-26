import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // ─── Production-safety preflight ────────────────────────────────────────
  // Refuse to boot in production with the default JWT secret. Other env vars
  // have safe degraded fallbacks (SMS=console, Email disabled, etc.) so we don't
  // hard-fail on those — but a default JWT secret is a critical security risk.
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET || '';
    if (!jwtSecret || jwtSecret === 'barsha-dev-secret-change-in-production' || jwtSecret === 'barsha-dev-secret-CHANGE-IN-PRODUCTION') {
      // eslint-disable-next-line no-console
      console.error('\n[FATAL] NODE_ENV=production but JWT_SECRET is unset or still the default placeholder.');
      // eslint-disable-next-line no-console
      console.error('[FATAL] Generate a strong secret:  openssl rand -base64 64');
      // eslint-disable-next-line no-console
      console.error('[FATAL] Then set JWT_SECRET=<value> in your environment and retry.\n');
      process.exit(1);
    }
    if (jwtSecret.length < 32) {
      // eslint-disable-next-line no-console
      console.warn('[WARN] JWT_SECRET is < 32 chars — recommend at least 64 chars for production.');
    }
    // Soft warnings for misconfigurations that won't block boot but degrade UX.
    if (process.env.EMAIL_ENABLED === 'true' && !process.env.SMTP_USER) {
      // eslint-disable-next-line no-console
      console.warn('[WARN] EMAIL_ENABLED=true but SMTP_USER is empty — emails will fail to send.');
    }
    if (process.env.SMS_ENABLED === 'true' && process.env.SMS_PROVIDER !== 'console' &&
        !process.env.SMS_TWILIO_ACCOUNT_SID && !process.env.SMS_INFOBIP_API_KEY) {
      // eslint-disable-next-line no-console
      console.warn('[WARN] SMS_ENABLED=true with provider != console but no provider credentials set.');
    }
    if (process.env.CTP_SANDBOX_MODE !== 'false') {
      // eslint-disable-next-line no-console
      console.warn('[WARN] CTP_SANDBOX_MODE is not "false" in production — card payments are sandboxed.');
    }
  }

  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // disable default parser so we can set custom limits
  });

  // BUG 1 FIX: Increase body parser limit for visual search base64 image uploads
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(json({ limit: '10mb' }));
  expressApp.use(urlencoded({ limit: '10mb', extended: true }));

  const configService = app.get(ConfigService);

  // BUG 2 FIX: Global prefix - exclude ALL Meilisearch-compatible /indexes routes
  // Using a regex that matches /indexes/<anything> including nested paths like
  // /indexes/products/search, /indexes/categories/123, /indexes/web-hp/search, etc.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'indexes/(.*)', method: RequestMethod.ALL },
      { path: 'health', method: RequestMethod.GET },
    ],
  });

  // BUG 3 FIX: CORS - explicitly allow Authorization header for Meilisearch search token
  const corsOrigins = configService.get<string>('cors.origins', 'http://localhost:4200');
  app.enableCors({
    origin: corsOrigins.split(',').map((o) => o.trim()),
    credentials: configService.get<boolean>('cors.allowCredentials', true),
    maxAge: configService.get<number>('cors.maxAge', 3600),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-Meili-API-Key',
    ],
    exposedHeaders: ['Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      forbidNonWhitelisted: false,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Note: TransformInterceptor removed — the Angular frontend expects raw API responses,
  // not wrapped in { data, meta }. Each controller returns its own response shape.

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Barsha E-Commerce API')
    .setDescription('API documentation for the Barsha e-commerce platform')
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Products', 'Product catalog')
    .addTag('Orders', 'Order management')
    .addTag('Cart', 'Shopping cart')
    .addTag('Payments', 'Payment processing')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  // Start server
  const port = configService.get<number>('port', 8000);
  await app.listen(port);
  logger.log(`Barsha API running on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
  logger.log(`Environment: ${configService.get<string>('environment', 'development')}`);
}

bootstrap();
