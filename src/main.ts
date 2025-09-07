import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './env';

async function bootstrap() {
  loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true }); // dev-only; tighten in prod
  await app.listen(process.env.PORT || 8080);
}
bootstrap();
