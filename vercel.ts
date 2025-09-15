import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './src/app.module';
import { loadEnv } from './src/env';
import express = require('express');
import type { VercelRequest, VercelResponse } from '@vercel/node';

let server: express.Express;

async function createServer(): Promise<express.Express> {
  if (!server) {
    loadEnv();
    
    const expressApp = express();
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        logger: ['error', 'warn', 'log'],
      }
    );

    // Configure CORS - more restrictive for production
    const corsOptions = {
      origin: process.env.FRONTEND_URL?.split(',') || ['https://jarvis2.vercel.app', 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    };
    
    app.enableCors(corsOptions);
    
    // Set global prefix for API routes
    app.setGlobalPrefix('api', {
      exclude: ['health', 'v1/health'] // Exclude health checks from prefix
    });

    await app.init();
    server = expressApp;
  }

  return server;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const server = await createServer();
  return server(req, res);
}