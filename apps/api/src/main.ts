import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 4000;

  // Global filters for exception handling
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global pipes for validation handling
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS for frontend integration
  app.enableCors();

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
