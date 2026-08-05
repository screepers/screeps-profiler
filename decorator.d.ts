type AnyMethod = (...args: any[]) => any;
type ClassConstructor = abstract new (...args: any[]) => any;

export interface ProfileDecoratorOptions {
  enabled?: boolean | (() => boolean);
}

interface ProfileDecoratorContext {
  kind: 'class' | 'method' | 'function';
  name: string | symbol | undefined;
}

export function configureProfileDecorator(options: ProfileDecoratorOptions): void;

/** Legacy class decorator (`experimentalDecorators: true`). */
export function profile(target: Function): void;

/** Legacy method decorator (`experimentalDecorators: true`). */
export function profile(
  target: object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<AnyMethod>,
): void;

/** Stage 3 class decorator (TypeScript 5+ default decorators). */
export function profile<T extends ClassConstructor>(
  target: T,
  context: ProfileDecoratorContext & { kind: 'class' },
): T;

/** Stage 3 method and function decorator (TypeScript 5+ default decorators). */
export function profile<T extends AnyMethod>(
  target: T,
  context: ProfileDecoratorContext & { kind: 'method' | 'function' },
): T;
