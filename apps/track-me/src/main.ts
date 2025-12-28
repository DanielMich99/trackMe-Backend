import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- CRITICAL: Enable CORS ---
  app.enableCors({
    origin: true, // Allow all origins (OK for development)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  // ---------------------------

  await app.listen(3000);
}
bootstrap();