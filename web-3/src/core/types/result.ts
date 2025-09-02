/**
 * Result and Either types for functional error handling
 */

/**
 * Result type for operations that can succeed or fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Either type for functional programming
 */
export type Either<L, R> =
  | { type: 'left'; value: L }
  | { type: 'right'; value: R };

/**
 * Option type for nullable values
 */
export type Option<T> =
  | { type: 'some'; value: T }
  | { type: 'none' };

/**
 * Create a successful Result
 */
export function ok<T, E = Error>(data: T): Result<T, E> {
  return { success: true, data };
}

/**
 * Create a failed Result
 */
export function err<T = never, E = Error>(error: E): Result<T, E> {
  return { success: false, error };
}

/**
 * Check if Result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Check if Result is error
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Create a left Either
 */
export function left<L, R = never>(value: L): Either<L, R> {
  return { type: 'left', value };
}

/**
 * Create a right Either
 */
export function right<L = never, R = any>(value: R): Either<L, R> {
  return { type: 'right', value };
}

/**
 * Check if Either is left
 */
export function isLeft<L, R>(either: Either<L, R>): either is { type: 'left'; value: L } {
  return either.type === 'left';
}

/**
 * Check if Either is right
 */
export function isRight<L, R>(either: Either<L, R>): either is { type: 'right'; value: R } {
  return either.type === 'right';
}

/**
 * Create a Some option
 */
export function some<T>(value: T): Option<T> {
  return { type: 'some', value };
}

/**
 * Create a None option
 */
export function none<T = never>(): Option<T> {
  return { type: 'none' };
}

/**
 * Check if Option is Some
 */
export function isSome<T>(option: Option<T>): option is { type: 'some'; value: T } {
  return option.type === 'some';
}

/**
 * Check if Option is None
 */
export function isNone<T>(option: Option<T>): option is { type: 'none' } {
  return option.type === 'none';
}

/**
 * Map over a Result
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.data));
  }
  return result;
}

/**
 * Map over an Either
 */
export function mapEither<L, R, U>(
  either: Either<L, R>,
  fn: (value: R) => U
): Either<L, U> {
  if (isRight(either)) {
    return right(fn(either.value));
  }
  return either;
}

/**
 * Map over an Option
 */
export function mapOption<T, U>(
  option: Option<T>,
  fn: (value: T) => U
): Option<U> {
  if (isSome(option)) {
    return some(fn(option.value));
  }
  return none();
}

/**
 * FlatMap over a Result
 */
export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.data);
  }
  return result;
}

/**
 * FlatMap over an Either
 */
export function flatMapEither<L, R, U>(
  either: Either<L, R>,
  fn: (value: R) => Either<L, U>
): Either<L, U> {
  if (isRight(either)) {
    return fn(either.value);
  }
  return either;
}

/**
 * FlatMap over an Option
 */
export function flatMapOption<T, U>(
  option: Option<T>,
  fn: (value: T) => Option<U>
): Option<U> {
  if (isSome(option)) {
    return fn(option.value);
  }
  return none();
}

/**
 * Get value from Result or throw
 */
export function unwrapResult<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.data;
  }
  throw result.error;
}

/**
 * Get value from Result or default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Get value from Option or throw
 */
export function unwrapOption<T>(option: Option<T>, message = 'None value'): T {
  if (isSome(option)) {
    return option.value;
  }
  throw new Error(message);
}

/**
 * Get value from Option or default
 */
export function unwrapOrDefault<T>(option: Option<T>, defaultValue: T): T {
  if (isSome(option)) {
    return option.value;
  }
  return defaultValue;
}

/**
 * Try to execute a function and return Result
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  mapError?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    if (mapError) {
      return err(mapError(error));
    }
    return err(error as E);
  }
}

/**
 * Try to execute async function and return Result
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  mapError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    if (mapError) {
      return err(mapError(error));
    }
    return err(error as E);
  }
}

/**
 * Convert nullable value to Option
 */
export function fromNullable<T>(value: T | null | undefined): Option<T> {
  if (value === null || value === undefined) {
    return none();
  }
  return some(value);
}

/**
 * Combine multiple Results into one
 */
export function combineResults<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const data: T[] = [];
  
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    data.push(result.data);
  }
  
  return ok(data);
}

/**
 * Combine multiple Options into one
 */
export function combineOptions<T>(options: Option<T>[]): Option<T[]> {
  const values: T[] = [];
  
  for (const option of options) {
    if (isNone(option)) {
      return none();
    }
    values.push(option.value);
  }
  
  return some(values);
}