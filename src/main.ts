import { AppModule } from '@module/app';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import Case from 'case';
import fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  const config: ConfigService = app.get(ConfigService);
  const NODE_ENV = config.get('NODE_ENV');

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true },
      enableDebugMessages: NODE_ENV !== 'production',
      whitelist: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle(Case.title(config.get('APP_NAME')))
    .setDescription(`The ${config.get('APP_NAME')} API description`)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
      },
      'accessJWT',
    )
    .addBearerAuth(
      {
        description: `This must be the update token when refreshing.`,
        type: 'http',
        in: 'header',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'refreshJWT',
    )
    .addTag('electron', 'electron apis')
    .addTag('expo', 'expo update apis')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('/api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      authAction: {
        accessJWT: {
          name: 'accessJWT',
          schema: {
            type: 'http',
            in: 'header',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          value: '213123',
        },
      },
      docExpansion: 'none',
      syntaxHighlight: {
        activate: true,
        theme: 'nord',
      },
    },
    customJs: 'https://cdn.flarelane.com/WebSDK.js',
    customJsStr: `FlareLane.initialize({ projectId: "c95fa7be-3d99-4d6f-8054-1cac6c3ed05a" });`,
  });

  generateDefaultDir();

  await app.listen(3000);
}
bootstrap();

function generateDefaultDir() {
  if (!fs.existsSync('./expo')) {
    fs.mkdirSync(`./expo`);
  }

  if (!fs.existsSync('./bundle')) {
    fs.mkdirSync(`./bundle`);
  }

  if (!fs.existsSync('./electron')) {
    fs.mkdirSync(`./electron`);
  }
}
