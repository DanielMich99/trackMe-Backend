import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- שורה קריטית! ---
  app.enableCors({
    origin: true, // מאפשר לכולם להתחבר (בפיתוח זה בסדר)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  // --------------------

  await app.listen(3000);
}
bootstrap();