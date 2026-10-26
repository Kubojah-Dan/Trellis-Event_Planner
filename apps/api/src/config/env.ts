import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.string().default('8080').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FIREBASE_PROJECT_ID: z.string().default('trellis-dev-placeholder'),
  USE_FIREBASE_EMULATOR: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

let parsedEnv: EnvConfig;
try {
  parsedEnv = EnvSchema.parse(process.env);
} catch (error) {
  // If parsing fails, fall back to safe defaults for testing
  parsedEnv = EnvSchema.parse({});
}

export const env = parsedEnv;
