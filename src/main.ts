import * as dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { NestFactory } from '@nestjs/core';
import {
  Logger,
  ValidationPipe,
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';

@Catch()
class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error(
        `${status} ${exception instanceof Error ? exception.message : 'Unknown error'}`,
      );
    }

    res
      .status(status)
      .json(
        typeof message === 'string' ? { statusCode: status, message } : message,
      );
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global exception filter — hide stack traces
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

  // CORS
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL?.replace(/\/+$/, ''),
  ].filter(Boolean);

  /** Storefront domains that should always be allowed (for the public widget) */
  const isStorefrontOrigin = (origin: string): boolean => {
    try {
      const { hostname } = new URL(origin);
      return (
        hostname.endsWith('.myharavan.com') || hostname.endsWith('.haravan.com')
      );
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, SSR)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow Haravan storefront origins (for public widget)
      if (isStorefrontOrigin(origin)) return callback(null, true);
      // In development, allow all
      if (process.env.NODE_ENV === 'development') return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'orgid',
      'x-orgid',
      'Authorization',
    ],
    exposedHeaders: ['set-cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
  // Serve storefront widget JS at /storefront/... (bypasses /api prefix)
  const storefrontPaths = [
    join(__dirname, 'storefront', 'snippets'),
    join(__dirname, '..', '..', 'storefront', 'snippets'),
    join(process.cwd(), 'storefront', 'snippets'),
    join(process.cwd(), '..', 'storefront', 'snippets'),
  ];
  for (const sp of storefrontPaths) {
    app.use(
      '/storefront',
      express.static(sp, {
        maxAge: 0,
        etag: true,
        lastModified: true,
        setHeaders: (res: any) => {
          res.set('Access-Control-Allow-Origin', '*');
          res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.set('Pragma', 'no-cache');
          res.set('Expires', '0');
        },
      }),
    );
  }

  // Global API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3333;
  await app.listen(port);
  Logger.log(`Server running on port ${port}`, 'Bootstrap');
}
void bootstrap();
