import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NEXTAUTH_URL: z.string().url().optional(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    
    // Optional production configs
    OTP_ENDPOINT: z.string().url().optional(),
    SENTRY_DSN: z.string().optional(),
    
    // Rate limiting
    RATE_LIMIT_ENABLED: z
      .string()
      .transform((s) => s === "true")
      .default("false")
      .optional(),
    RATE_LIMIT_WINDOW_MS: z
      .string()
      .transform((s) => parseInt(s, 10))
      .default("60000")
      .optional(),
    RATE_LIMIT_MAX_REQUESTS: z
      .string()
      .transform((s) => parseInt(s, 10))
      .default("100")
      .optional(),
    
    // Scraping config
    SCRAPING_USER_AGENT: z.string().default("Mozilla/5.0 (compatible; TokyoApartmentFinder/1.0)").optional(),
    SCRAPING_RATE_LIMIT_MS: z
      .string()
      .transform((s) => parseInt(s, 10))
      .default("2000")
      .optional(),
    SCRAPING_MAX_RETRIES: z
      .string()
      .transform((s) => parseInt(s, 10))
      .default("3")
      .optional(),
    
    // Performance optimization
    REDIS_URL: z.string().url().optional(),
    CACHE_TTL_SEARCH: z
      .string()
      .transform((s) => parseInt(s, 10))
      .default("1800")
      .optional(),
    CACHE_TTL_APARTMENT: z
      .string()
      .transform((s) => parseInt(s, 10))
      .default("600")
      .optional(),
    CACHE_TTL_POPULAR: z
      .string()
      .transform((s) => parseInt(s, 10))
      .default("3600")
      .optional(),
    ENABLE_PERFORMANCE_MONITORING: z
      .string()
      .transform((s) => s === "true")
      .default("true")
      .optional(),
    PERFORMANCE_REPORT_INTERVAL: z
      .string()
      .transform((s) => parseInt(s, 10))
      .default("3600000")
      .optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_IMAGE_CDN_URL: z.string().url().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    OTP_ENDPOINT: process.env.OTP_ENDPOINT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    SCRAPING_USER_AGENT: process.env.SCRAPING_USER_AGENT,
    SCRAPING_RATE_LIMIT_MS: process.env.SCRAPING_RATE_LIMIT_MS,
    SCRAPING_MAX_RETRIES: process.env.SCRAPING_MAX_RETRIES,
    REDIS_URL: process.env.REDIS_URL,
    CACHE_TTL_SEARCH: process.env.CACHE_TTL_SEARCH,
    CACHE_TTL_APARTMENT: process.env.CACHE_TTL_APARTMENT,
    CACHE_TTL_POPULAR: process.env.CACHE_TTL_POPULAR,
    ENABLE_PERFORMANCE_MONITORING: process.env.ENABLE_PERFORMANCE_MONITORING,
    PERFORMANCE_REPORT_INTERVAL: process.env.PERFORMANCE_REPORT_INTERVAL,
    NEXT_PUBLIC_IMAGE_CDN_URL: process.env.NEXT_PUBLIC_IMAGE_CDN_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
