import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const environment = configService.get<string>('environment', 'development');
        const isDevelopment = environment === 'development';
        const dbType = configService.get<string>('database.type', 'mssql');

        // SQL Server (MSSQL) - Primary for local development
        if (dbType === 'mssql') {
          return {
            type: 'mssql' as const,
            host: configService.get<string>('database.host', 'DESKTOP-KOR5QAB'),
            port: configService.get<number>('database.port', 1433),
            username: configService.get<string>('database.username', 'admin'),
            password: configService.get<string>('database.password', 'admin123'),
            database: configService.get<string>('database.name', 'barsha'),
            entities: [__dirname + '/../**/*.entity{.ts,.js}'],
            synchronize: isDevelopment,
            autoLoadEntities: true,
            logging: isDevelopment ? ['error', 'warn'] : ['error'],
            options: {
              encrypt: false,
              trustServerCertificate: true,
            },
            extra: {
              trustServerCertificate: true,
            },
          };
        }

        // PostgreSQL
        const dbUrl = configService.get<string>('database.url', '');
        if (dbType === 'postgres' || dbUrl.startsWith('postgres')) {
          return {
            type: 'postgres' as const,
            url: dbUrl,
            entities: [__dirname + '/../**/*.entity{.ts,.js}'],
            synchronize: isDevelopment,
            logging: isDevelopment ? ['error'] : ['error'],
            autoLoadEntities: true,
          };
        }

        // SQLite fallback
        const dbPath = dbUrl.replace(/^sqlite:\/\/\//, '') || 'barsha.db';
        return {
          type: 'sqlite' as const,
          database: dbPath,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: isDevelopment,
          logging: isDevelopment ? ['error'] : ['error'],
          autoLoadEntities: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
