import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './env';

async function bootstrap() {
  loadEnv();
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Configure CORS - more restrictive for production
  const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL?.split(',') || false
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  };
  
  app.enableCors(corsOptions);
  
  // Set global prefix for API routes
  app.setGlobalPrefix('api', {
    exclude: ['health', 'v1/*'] // Exclude health checks and all v1 routes from prefix
  });

  const port = process.env.PORT || 8080;
  
  await app.listen(port, '0.0.0.0'); // Bind to all interfaces for Railway
  
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health check available at /v1/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch(err => {
  console.error('❌ Error starting server:', err);
  process.exit(1);
});
