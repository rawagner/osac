import { PluginExtension } from './extensions';

type LoadedPluginExtension = PluginExtension & { id: string };

export type PluginDescriptor = {
  apiVersion: 'osac.ui.plugin.v1';
  id: string;
  name: string;
  extensions: LoadedPluginExtension[];
};

const PLUGIN_API_VERSION = 'osac.ui.plugin.v1';
const EXTENSION_TYPE_PREFIX = 'osac.ui.extension.v1.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPluginExtensionEnvelope = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.type === 'string' &&
  value.type.startsWith(EXTENSION_TYPE_PREFIX) &&
  value.type.length > EXTENSION_TYPE_PREFIX.length &&
  isRecord(value.properties);

const addExtensionIds = (
  pluginId: string,
  extensions: PluginExtension[],
): LoadedPluginExtension[] =>
  extensions.map((extension, index) => ({
    ...extension,
    id: `${pluginId}:${index}`,
  }));

export const parsePluginDescriptor = (
  json: string,
  configuredPluginId: string,
): PluginDescriptor => {
  let descriptor: unknown;
  try {
    descriptor = JSON.parse(json);
  } catch {
    throw new Error('Plugin descriptor is not valid JSON');
  }

  if (!isRecord(descriptor)) {
    throw new Error('Plugin descriptor must be a descriptor object');
  }
  if (descriptor.apiVersion !== PLUGIN_API_VERSION) {
    throw new Error(`Plugin descriptor apiVersion must be ${PLUGIN_API_VERSION}`);
  }
  if (descriptor.id !== configuredPluginId) {
    throw new Error(
      `Descriptor ID "${String(descriptor.id)}" does not match configured plugin ID "${configuredPluginId}"`,
    );
  }
  if (typeof descriptor.name !== 'string') {
    throw new Error('Plugin descriptor name must be a string');
  }
  if (
    !Array.isArray(descriptor.extensions) ||
    !descriptor.extensions.every(isPluginExtensionEnvelope)
  ) {
    throw new Error(
      `Plugin descriptor extensions must contain package-qualified extension types and properties objects`,
    );
  }

  const loadedExtensions = addExtensionIds(
    descriptor.pluginId as string,
    descriptor.extensions as PluginExtension[],
  );

  return {
    ...descriptor,
    extensions: loadedExtensions,
  } as PluginDescriptor;
};
