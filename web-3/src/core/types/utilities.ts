/**
 * Shared type utilities for the application
 */

/**
 * Make all properties in T optional recursively
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/**
 * Make all properties in T required recursively
 */
export type DeepRequired<T> = T extends object
  ? {
      [P in keyof T]-?: DeepRequired<T[P]>;
    }
  : T;

/**
 * Make all properties in T readonly recursively
 */
export type DeepReadonly<T> = T extends object
  ? {
      readonly [P in keyof T]: DeepReadonly<T[P]>;
    }
  : T;

/**
 * Extract keys from T that have required values
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Extract keys from T that have optional values
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Make specified keys K in T optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specified keys K in T required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Extract non-nullable type from T
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Extract nullable properties from T
 */
export type NullableKeys<T> = {
  [K in keyof T]: null extends T[K] ? K : never;
}[keyof T];

/**
 * Extract non-nullable properties from T
 */
export type NonNullableKeys<T> = {
  [K in keyof T]: null extends T[K] ? never : K;
}[keyof T];

/**
 * Merge two types with B overriding A
 */
export type Merge<A, B> = Omit<A, keyof B> & B;

/**
 * Extract properties from T that are assignable to U
 */
export type PickByValue<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

/**
 * Exclude properties from T that are assignable to U
 */
export type OmitByValue<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

/**
 * Make an immutable version of T
 */
export type Immutable<T> = {
  readonly [K in keyof T]: T[K] extends object ? Immutable<T[K]> : T[K];
};

/**
 * Make a mutable version of T
 */
export type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K];
};

/**
 * Extract function property names from T
 */
export type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/**
 * Extract non-function property names from T
 */
export type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

/**
 * Create a type that represents either success or failure
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create a type that represents an optional value
 */
export type Option<T> = T | null | undefined;

/**
 * Extract the element type from an array type
 */
export type ElementType<T> = T extends (infer E)[] ? E : never;

/**
 * Create a type with a subset of properties from T
 */
export type Subset<T, U extends T> = U;

/**
 * Create a type that requires at least one of the given properties
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Create a type that requires exactly one of the given properties
 */
export type RequireExactlyOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> &
      Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];

/**
 * Create a type from an enum
 */
export type EnumType<T> = T[keyof T];

/**
 * Create a union type from object values
 */
export type ValueOf<T> = T[keyof T];

/**
 * Create a promise type that resolves to T
 */
export type AsyncReturnType<T extends (...args: any[]) => Promise<any>> =
  T extends (...args: any[]) => Promise<infer R> ? R : never;

/**
 * Extract promise type
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Create a type for class constructors
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Create a type for abstract class constructors
 */
export type AbstractConstructor<T = {}> = abstract new (...args: any[]) => T;

/**
 * Prettify complex types for better IDE display
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};