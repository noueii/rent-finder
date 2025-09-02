/**
 * Advanced utility types for type-safe development
 */

// Deep operations
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

export type DeepRequired<T> = T extends object
  ? { [P in keyof T]-?: DeepRequired<T[P]> }
  : T;

// Key manipulation
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type PickRequired<T> = Pick<T, RequiredKeys<T>>;
export type PickOptional<T> = Pick<T, OptionalKeys<T>>;

// Type filtering
export type NonNullableKeys<T> = {
  [K in keyof T]: T[K] extends null | undefined ? never : K;
}[keyof T];

export type NullableKeys<T> = {
  [K in keyof T]: T[K] extends null | undefined ? K : never;
}[keyof T];

// Function types
export type Fn<Args extends any[] = any[], Return = any> = (...args: Args) => Return;
export type AsyncFn<Args extends any[] = any[], Return = any> = (...args: Args) => Promise<Return>;

// Extract types
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
export type UnwrapArray<T> = T extends (infer U)[] ? U : T;
export type UnwrapFunction<T> = T extends (...args: any[]) => infer U ? U : T;

// Conditional types
export type If<C extends boolean, T, F> = C extends true ? T : F;
export type Not<T extends boolean> = T extends true ? false : true;

// Object manipulation
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type Immutable<T> = {
  readonly [P in keyof T]: T[P];
};

// Merge types
export type Merge<T, U> = Omit<T, keyof U> & U;

// Extract specific value types
export type ValueOf<T> = T[keyof T];
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

// Exhaustive check helper
export type Exhaustive<T> = T extends never ? true : false;

// Type-safe dot notation paths
export type Path<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? K | `${K}.${Path<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

// Type-safe path value extraction
export type PathValue<T, P extends Path<T>> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? R extends Path<T[K]>
      ? PathValue<T[K], R>
      : never
    : never
  : never;