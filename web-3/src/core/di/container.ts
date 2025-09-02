/**
 * Dependency Injection Container implementation
 * Supports transient, singleton, and scoped registrations
 */

import type { IContainer, InjectionToken, Factory } from './types';

interface Registration<T> {
  factory: Factory<T>;
  type: 'transient' | 'singleton';
  instance?: T;
}

export class Container implements IContainer {
  private registrations = new Map<string, Registration<any>>();
  private parent?: IContainer;

  constructor(parent?: IContainer) {
    this.parent = parent;
  }

  register<T>(token: InjectionToken<T>, factory: Factory<T>): void {
    this.registrations.set(token.name, {
      factory,
      type: 'transient'
    });
  }

  registerSingleton<T>(token: InjectionToken<T>, factory: Factory<T>): void {
    this.registrations.set(token.name, {
      factory,
      type: 'singleton'
    });
  }

  resolve<T>(token: InjectionToken<T>): T {
    const registration = this.registrations.get(token.name);
    
    if (!registration) {
      // Check parent container if this is a scoped container
      if (this.parent) {
        return this.parent.resolve(token);
      }
      throw new Error(`No registration found for token: ${token.name}`);
    }

    // Handle singleton
    if (registration.type === 'singleton') {
      if (!registration.instance) {
        registration.instance = registration.factory(this);
      }
      return registration.instance;
    }

    // Handle transient
    return registration.factory(this);
  }

  createScope(): IContainer {
    // Create a child container that inherits from this one
    return new Container(this);
  }

  /**
   * Check if a token is registered
   */
  has<T>(token: InjectionToken<T>): boolean {
    return this.registrations.has(token.name) || (this.parent?.has(token) ?? false);
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.registrations.clear();
  }
}

/**
 * Create a root container instance
 */
export function createContainer(): IContainer {
  return new Container();
}