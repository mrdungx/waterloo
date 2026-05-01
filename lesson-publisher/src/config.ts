import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().url(),

  AHASLIDES_CORE_URL: z.string().url(),
  AHASLIDES_OAUTH_CLIENT_ID: z.string(),
  AHASLIDES_OAUTH_CLIENT_SECRET: z.string(),

  LEARNER_JWT_SECRET: z.string().min(32),

  S3_BUCKET: z.string().default('ahaslides-learning'),
  S3_REGION: z.string().default('ap-southeast-1'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
