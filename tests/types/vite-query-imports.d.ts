/**
 * Vitest cache-busting query suffixes on dynamic imports.
 *
 * `import('@/lib/env?reset')` and `?fresh` are the same module, but the
 * suffix forces Vitest's module cache to evaluate `lib/env.ts` afresh
 * (re-running the top-level `safeParse(process.env)`). TypeScript has no
 * built-in understanding of these query strings, so we declare them as
 * ambient modules that re-export everything from `@/lib/env`.
 *
 * Only `?reset` and `?fresh` are declared because those are the suffixes
 * `tests/lib/env.test.ts` actually uses today. Add more here as needed.
 */
declare module '@/lib/env?reset' {
  export * from '@/lib/env';
}

declare module '@/lib/env?fresh' {
  export * from '@/lib/env';
}
