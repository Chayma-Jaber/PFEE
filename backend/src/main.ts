import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
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
