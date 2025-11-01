import { z } from 'zod';

/**
 * Environment Variable Schema
 * Validates all required environment variables on server startup
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  
  // Server
  PORT: z.preprocess(
    (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return val.trim();
      return val;
    },
    z.string().regex(/^\d+$/, 'PORT must be a number').transform(Number)
  ).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // CORS
  CORS_ORIGIN: z.string().url('CORS_ORIGIN must be a valid URL'),
  
  // WebSocket
  WS_URL: z.string().url('WS_URL must be a valid URL').optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables on server startup
 * Exits process if validation fails
 */
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('❌ Environment validation error:', error);
    }
    console.error('\n💡 See env.example for reference configuration\n');
    process.exit(1);
  }
}

/**
 * Get validated environment configuration
 * Should be called after validateEnv()
 */
export function getEnv(): Env {
  return envSchema.parse(process.env);
}
