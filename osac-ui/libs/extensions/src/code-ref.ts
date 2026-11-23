import { loadRemote } from '@module-federation/runtime';

import { isPlainObject } from './utils';

const codeRefSymbol: unique symbol = Symbol('CodeRef');
declare const encodedCodeRefValue: unique symbol;

export type CodeRef<T = unknown> = (() => Promise<T>) & {
  readonly [codeRefSymbol]: true;
};

export type EncodedCodeRef<T = unknown> = {
  $codeRef: string;
  readonly [encodedCodeRefValue]?: T;
};

export type MapEncodedCodeRefsToCodeRefs<T> =
  T extends EncodedCodeRef<infer Value>
    ? CodeRef<Value>
    : T extends readonly unknown[]
      ? { [Index in keyof T]: MapEncodedCodeRefsToCodeRefs<T[Index]> }
      : T extends (...args: never[]) => unknown
        ? T
        : T extends object
          ? { [Key in keyof T]: MapEncodedCodeRefsToCodeRefs<T[Key]> }
          : T;

export type MapCodeRefsToValues<T> =
  T extends CodeRef<infer Value>
    ? Value
    : T extends readonly unknown[]
      ? { [Index in keyof T]: MapCodeRefsToValues<T[Index]> }
      : T extends (...args: never[]) => unknown
        ? T
        : T extends object
          ? { [Key in keyof T]: MapCodeRefsToValues<T[Key]> }
          : T;

export const markCodeRef = <Value>(codeRef: () => Promise<Value>): CodeRef<Value> => {
  Object.defineProperty(codeRef, codeRefSymbol, { value: true });
  return codeRef as CodeRef<Value>;
};

export const isCodeRef = <Value = unknown>(value: unknown): value is CodeRef<Value> => {
  if (typeof value !== 'function') {
    return false;
  }

  const symbols = Object.getOwnPropertySymbols(value);
  return (
    symbols.length === 1 &&
    symbols[0] === codeRefSymbol &&
    (value as CodeRef<unknown>)[codeRefSymbol] === true
  );
};

export const isEncodedCodeRef = (value: unknown): value is EncodedCodeRef<unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  const propertyNames = Object.getOwnPropertyNames(value);
  return (
    propertyNames.length === 1 &&
    propertyNames[0] === '$codeRef' &&
    typeof (value as EncodedCodeRef).$codeRef === 'string'
  );
};

export const resolveCodeRefs = async <Value>(value: Value): Promise<MapCodeRefsToValues<Value>> => {
  if (isCodeRef<MapCodeRefsToValues<Value>>(value)) {
    return await value();
  }

  if (Array.isArray(value)) {
    const resolvedItems = await Promise.all(value.map((item) => resolveCodeRefs(item)));
    return resolvedItems as MapCodeRefsToValues<Value>;
  }

  if (isPlainObject(value)) {
    const resolvedEntries = await Promise.all(
      Object.entries(value).map(async ([key, item]) => [key, await resolveCodeRefs(item)] as const),
    );
    return Object.fromEntries(resolvedEntries) as MapCodeRefsToValues<Value>;
  }

  return value as MapCodeRefsToValues<Value>;
};

const parseCodeRef = (value: string): [string, string] | undefined => {
  const separator = value.indexOf('.');
  const moduleName = separator === -1 ? value : value.slice(0, separator);
  const exportName = separator === -1 ? 'default' : value.slice(separator + 1);

  return moduleName && exportName ? [moduleName, exportName] : undefined;
};

export const createCodeRef = <Value>(
  pluginId: string,
  encodedCodeRef: EncodedCodeRef,
): CodeRef<Value> =>
  markCodeRef(async () => {
    const parsedCodeRef = parseCodeRef(encodedCodeRef.$codeRef);

    if (!parsedCodeRef) {
      throw new Error(
        `Plugin ${pluginId} has an invalid code reference: ${encodedCodeRef.$codeRef}`,
      );
    }

    const [moduleName, exportName] = parsedCodeRef;
    const specifier = `${pluginId}/${moduleName}`;
    const remoteModule = await loadRemote<Record<string, unknown>>(specifier);

    if (!remoteModule || !(exportName in remoteModule)) {
      throw new Error(
        `Federated module ${specifier} must export ${exportName} for plugin ${pluginId}`,
      );
    }

    return remoteModule[exportName] as Value;
  });
