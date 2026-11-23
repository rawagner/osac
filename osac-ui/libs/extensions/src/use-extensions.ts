import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  type MapCodeRefsToValues,
  type MapEncodedCodeRefsToCodeRefs,
  createCodeRef,
  isEncodedCodeRef,
  resolveCodeRefs,
} from './code-ref';
import type { PluginExtension } from './extensions/base';
import type { PluginDescriptor } from './plugin-descriptor';
import { PluginDescriptorsContext } from './plugins-context';
import { isPlainObject } from './utils';

type PluginExtensionError = {
  pluginId: string;
  extensionId?: string;
  stage: string;
  message: string;
};

type PluginExtensionGuard<Extension extends PluginExtension> = (
  extension: PluginExtension,
) => extension is Extension;

type ExecutablePluginExtension<Extension extends PluginExtension> =
  MapEncodedCodeRefsToCodeRefs<Extension> & PluginExtensionMetadata;

type ResolvedPluginExtension<Extension extends PluginExtension> = MapCodeRefsToValues<
  ExecutablePluginExtension<Extension>
>;

type PluginExtensionMetadata = { id: string; pluginId: string };

const replaceEncodedCodeRefs = <Value>(
  value: Value,
  descriptor: PluginDescriptor,
): MapEncodedCodeRefsToCodeRefs<Value> => {
  if (isEncodedCodeRef(value)) {
    return createCodeRef(descriptor.id, value) as MapEncodedCodeRefsToCodeRefs<Value>;
  }

  if (Array.isArray(value)) {
    return value.map((item: unknown) =>
      replaceEncodedCodeRefs(item, descriptor),
    ) as MapEncodedCodeRefsToCodeRefs<Value>;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceEncodedCodeRefs(item, descriptor)]),
    ) as MapEncodedCodeRefsToCodeRefs<Value>;
  }

  return value as MapEncodedCodeRefsToCodeRefs<Value>;
};

const createExecutableExtension = <Extension extends PluginExtension>(
  descriptor: PluginDescriptor,
  extension: Extension & { id: string },
): ExecutablePluginExtension<Extension> => {
  const metadata: PluginExtensionMetadata = { id: extension.id, pluginId: descriptor.id };
  const properties = replaceEncodedCodeRefs(extension.properties, descriptor);
  return {
    ...extension,
    ...metadata,
    properties,
  } as unknown as ExecutablePluginExtension<Extension>;
};

const resolveExtension = async <Extension extends PluginExtension>(
  extension: ExecutablePluginExtension<Extension>,
): Promise<ResolvedPluginExtension<Extension>> => {
  const properties = await resolveCodeRefs(extension.properties);
  return { ...extension, properties } as ResolvedPluginExtension<Extension>;
};

export const useExtensions = <Extension extends PluginExtension>(
  ...typeGuards: PluginExtensionGuard<Extension>[]
): [ExecutablePluginExtension<Extension>[], boolean] => {
  const { descriptors, isLoading } = useContext(PluginDescriptorsContext);
  const typeGuardsRef = useRef(typeGuards);

  if (
    typeGuardsRef.current.length !== typeGuards.length ||
    typeGuards.some((typeGuard, index) => typeGuard !== typeGuardsRef.current[index])
  ) {
    typeGuardsRef.current = typeGuards;
  }

  const activeTypeGuards = typeGuardsRef.current;

  const extensions = useMemo(
    () =>
      descriptors.flatMap((descriptor) =>
        descriptor.extensions
          .filter((extension) => activeTypeGuards.some((typeGuard) => typeGuard(extension)))
          .map((extension) =>
            createExecutableExtension(descriptor, extension as Extension & { id: string }),
          ),
      ),
    [descriptors, activeTypeGuards],
  );

  if (typeGuards.length === 0) {
    throw new Error('Pass at least one extension type guard to useExtensions');
  }

  return [extensions, isLoading];
};

export const useResolvedExtensions = <Extension extends PluginExtension>(
  ...typeGuards: PluginExtensionGuard<Extension>[]
): [ResolvedPluginExtension<Extension>[], boolean, PluginExtensionError[] | undefined] => {
  const [extensions, pluginsLoading] = useExtensions(...typeGuards);
  const [errors, setErrors] = useState<PluginExtensionError[]>();
  const [resolvedExtensions, setResolvedExtensions] = useState<
    ResolvedPluginExtension<Extension>[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (pluginsLoading) {
      return;
    }
    setErrors(undefined);
    let isActive = true;

    (async () => {
      const results = await Promise.allSettled(
        extensions.map((extension) => resolveExtension(extension)),
      );
      if (!isActive) {
        return;
      }
      const resolvedExtensions: ResolvedPluginExtension<Extension>[] = [];
      const errors: PluginExtensionError[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          resolvedExtensions.push(result.value);
        } else {
          const extension = extensions[index];
          if (!extension) {
            return;
          }
          errors.push({
            pluginId: extension.pluginId,
            extensionId: extension.id,
            stage: 'resolve extension module',
            message: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      });

      setIsLoading(false);
      if (errors.length) {
        setErrors(errors);
      }
      setResolvedExtensions(resolvedExtensions);
    })();

    return () => {
      isActive = false;
    };
  }, [extensions, pluginsLoading]);

  return [resolvedExtensions, isLoading || pluginsLoading, errors];
};
