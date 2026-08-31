import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, !origin || allowedOrigins.has(origin)),
  });
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
