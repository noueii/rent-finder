/**
 * Dependency Injection type definitions
 * Based on contracts in REFACTOR-CONTRACTS.md
 */

export interface IContainer {
  register<T>(token: InjectionToken<T>, factory: Factory<T>): void;
  registerSingleton<T>(token: InjectionToken<T>, factory: Factory<T>): void;
  resolve<T>(token: InjectionToken<T>): T;
  createScope(): IContainer;
  has<T>(token: InjectionToken<T>): boolean;
}

export interface InjectionToken<T> {
  name: string;
  type?: T;
}

export type Factory<T> = (container: IContainer) => T;

/**
 * Create a type-safe injection token
 */
export function createToken<T>(name: string): InjectionToken<T> {
  return { name };
}