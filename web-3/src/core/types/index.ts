/**
 * Core type utilities and exports
 */

// Export utility types (has Option as type alias)
export * from './utilities';

// Export all type guards and assertions
export * from './guards';

// Export all branded types
export * from './branded';

// Export Result/Either types (has Option as discriminated union)
// Rename to avoid conflict
export type { Result, Option as ResultOption } from './result';
export {
  ok,
  err,
  isOk,
  isErr,
  left,
  right,
  isLeft,
  isRight,
  mapResult,
  mapEither,
  flatMapResult,
  flatMapEither,
  unwrapResult,
  unwrapOr,
  some,
  none,
  isSome,
  isNone,
  mapOption,
  flatMapOption,
  unwrapOption,
  unwrapOrDefault,
  fromNullable,
  combineOptions,
  combineResults,
  tryCatch
} from './result';