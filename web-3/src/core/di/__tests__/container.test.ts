/**
 * Tests for DI Container implementation
 */

import { Container, createContainer } from '../container';
import { createToken } from '../types';
import type { InjectionToken, IContainer } from '../types';

describe('Container', () => {
  let container: IContainer;

  beforeEach(() => {
    container = new Container();
  });

  describe('Transient Registration', () => {
    interface TestService {
      id: number;
    }

    const token = createToken<TestService>('TestService');
    let idCounter = 0;

    beforeEach(() => {
      idCounter = 0;
      container.register(token, () => ({ id: ++idCounter }));
    });

    it('should create new instance each time', () => {
      const instance1 = container.resolve(token);
      const instance2 = container.resolve(token);

      expect(instance1.id).toBe(1);
      expect(instance2.id).toBe(2);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Singleton Registration', () => {
    interface DatabaseService {
      id: number;
      connect(): void;
    }

    const token = createToken<DatabaseService>('DatabaseService');
    let idCounter = 0;

    beforeEach(() => {
      idCounter = 0;
      container.registerSingleton(token, () => ({
        id: ++idCounter,
        connect: jest.fn()
      }));
    });

    it('should return same instance', () => {
      const instance1 = container.resolve(token);
      const instance2 = container.resolve(token);

      expect(instance1.id).toBe(1);
      expect(instance2.id).toBe(1);
      expect(instance1).toBe(instance2);
    });
  });

  describe('Dependency Resolution', () => {
    interface Logger {
      log(message: string): void;
    }

    interface Service {
      logger: Logger;
      doWork(): void;
    }

    const loggerToken = createToken<Logger>('Logger');
    const serviceToken = createToken<Service>('Service');

    beforeEach(() => {
      container.registerSingleton(loggerToken, () => ({
        log: jest.fn()
      }));

      container.register(serviceToken, (container) => ({
        logger: container.resolve(loggerToken),
        doWork: jest.fn()
      }));
    });

    it('should resolve nested dependencies', () => {
      const service = container.resolve(serviceToken);
      const logger = container.resolve(loggerToken);

      expect(service.logger).toBe(logger);
    });
  });

  describe('Scoped Containers', () => {
    interface RequestService {
      requestId: string;
    }

    const token = createToken<RequestService>('RequestService');

    beforeEach(() => {
      // Register in parent as singleton
      container.registerSingleton(token, () => ({ requestId: 'parent' }));
    });

    it('should create isolated scope', () => {
      const scope1 = container.createScope();
      const scope2 = container.createScope();

      // Override in scope 1
      (scope1 as Container).registerSingleton(token, () => ({ requestId: 'scope1' }));

      const parentInstance = container.resolve(token);
      const scope1Instance = scope1.resolve(token);
      const scope2Instance = scope2.resolve(token);

      expect(parentInstance.requestId).toBe('parent');
      expect(scope1Instance.requestId).toBe('scope1');
      expect(scope2Instance.requestId).toBe('parent'); // Inherits from parent
    });

    it('should inherit parent registrations', () => {
      const parentToken = createToken<{ value: string }>('ParentService');
      container.register(parentToken, () => ({ value: 'from-parent' }));

      const scope = container.createScope();
      const instance = scope.resolve(parentToken);

      expect(instance.value).toBe('from-parent');
    });
  });

  describe('Error Handling', () => {
    it('should throw for unregistered token', () => {
      const token = createToken('UnregisteredService');

      expect(() => container.resolve(token)).toThrow(
        'No registration found for token: UnregisteredService'
      );
    });
  });

  describe('Utility Methods', () => {
    const token = createToken('TestService');

    it('should check if token is registered', () => {
      expect(container.has(token)).toBe(false);
      
      container.register(token, () => ({}));
      
      expect(container.has(token)).toBe(true);
    });

    it('should clear all registrations', () => {
      container.register(token, () => ({}));
      expect(container.has(token)).toBe(true);

      (container as Container).clear();
      
      expect(container.has(token)).toBe(false);
    });

    it('should check parent for registration', () => {
      const parentToken = createToken('ParentService');
      container.register(parentToken, () => ({}));

      const scope = container.createScope() as Container;
      
      expect(scope.has(parentToken)).toBe(true);
    });
  });

  describe('createContainer Helper', () => {
    it('should create a new container instance', () => {
      const container1 = createContainer();
      const container2 = createContainer();

      expect(container1).toBeInstanceOf(Container);
      expect(container2).toBeInstanceOf(Container);
      expect(container1).not.toBe(container2);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle circular dependencies gracefully', () => {
      interface A { b: B }
      interface B { a: A }

      const tokenA = createToken<A>('A');
      const tokenB = createToken<B>('B');

      container.register(tokenA, (c: IContainer) => ({ b: c.resolve(tokenB) }));
      container.register(tokenB, (c: IContainer) => ({ a: c.resolve(tokenA) }));

      // This will cause infinite recursion - in a real implementation
      // we might want to detect and handle this
      expect(() => container.resolve(tokenA)).toThrow();
    });

    it('should support factory functions with closures', () => {
      let counter = 0;
      const token = createToken<{ value: number }>('Counter');

      container.register(token, () => {
        counter++;
        return { value: counter };
      });

      const instance1 = container.resolve(token);
      const instance2 = container.resolve(token);

      expect(instance1.value).toBe(1);
      expect(instance2.value).toBe(2);
    });
  });
});