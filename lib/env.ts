import { z } from 'zod';

const schema = z.object({
  // Supabase (replaces Clerk + Neon — see docs/superpowers/notes/2026-05-13-supabase-pivot.md)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Sentry (optional in dev, required in prod)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Coach contact (public)
  NEXT_PUBLIC_COACH_WHATSAPP: z.string().min(1),
  NEXT_PUBLIC_COACH_CALENDLY: z.string().url(),

  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables — see logs above.');
}

export const env = parsed.data;
