import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'orgid',
      'x-orgid',
      'Accept',
    ],
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3333;
  await app.listen(port);
  Logger.log(`Server running on port ${port}`, 'Bootstrap');
}
void bootstrap();
