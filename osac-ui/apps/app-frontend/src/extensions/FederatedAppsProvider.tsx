import { type ReactNode } from 'react';
import { registerRemotes } from '@module-federation/runtime';
import { useQuery } from '@tanstack/react-query';

import {
  PluginDescriptor,
  PluginDescriptorsContext,
  parsePluginDescriptor,
} from '@osac/extensions';
import { getErrorMessage } from '@osac/ui-components/utils/error';

type PluginSource = {
  id: string;
  url: string;
};

type PluginRemote = {
  descriptor: PluginDescriptor;
  entryUrl: string;
};

type RemoteRegistration = {
  name: string;
  entry: string;
  type: 'module';
};

const EMPTY_PLUGIN_DESCRIPTORS: PluginDescriptor[] = [];

const logPluginFailure = (pluginId: string, stage: string, error: unknown): void => {
  // eslint-disable-next-line no-console -- plugin load diagnostics are requested in the browser console
  console.error('OSAC UI plugin failed', {
    pluginId,
    stage,
    message: getErrorMessage(error),
  });
};

export const registerPluginRemotes = (
  remotes: PluginRemote[],
  registerRemote: (remote: RemoteRegistration) => void,
): PluginDescriptor[] => {
  const descriptors: PluginDescriptor[] = [];

  remotes.forEach(({ descriptor, entryUrl }) => {
    try {
      registerRemote({ name: descriptor.id, entry: entryUrl, type: 'module' });
      descriptors.push(descriptor);
    } catch (error) {
      logPluginFailure(descriptor.id, 'register remote', error);
    }
  });

  return descriptors;
};

const loadPluginDescriptors = async (): Promise<PluginDescriptor[]> => {
  let sources: PluginSource[];
  try {
    const sourcesResponse = await fetch('/api/plugins');

    if (!sourcesResponse.ok) {
      throw new Error(`HTTP ${sourcesResponse.status}`);
    }

    sources = (await sourcesResponse.json()) as PluginSource[];
  } catch (error) {
    logPluginFailure('plugin-registry', 'fetch plugin list', error);
    return [];
  }

  const attempts = await Promise.all(
    sources.map(async (source) => {
      let stage = 'resolve plugin URL';
      try {
        const pluginBaseUrl = new URL(source.url.endsWith('/') ? source.url : `${source.url}/`);
        const descriptorUrl = new URL('./osac-plugin.json', pluginBaseUrl);
        stage = 'fetch plugin descriptor';
        const response = await fetch(descriptorUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        stage = 'validate plugin descriptor';
        const descriptor = parsePluginDescriptor(await response.text(), source.id);

        const entryUrl = new URL('./mf-manifest.json', pluginBaseUrl);

        return {
          descriptor,
          entryUrl: entryUrl.href,
        } satisfies PluginRemote;
      } catch (error) {
        logPluginFailure(source.id, stage, error);
        return null;
      }
    }),
  );

  const remotes = attempts.filter((attempt): attempt is PluginRemote => attempt !== null);
  return registerPluginRemotes(remotes, (remote) => registerRemotes([remote]));
};

export const FederatedAppsProvider = ({ children }: { children: ReactNode }) => {
  const { data = EMPTY_PLUGIN_DESCRIPTORS, isLoading } = useQuery({
    queryKey: ['pluginDescriptors'],
    queryFn: loadPluginDescriptors,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  return (
    <PluginDescriptorsContext.Provider
      value={{
        descriptors: data,
        isLoading,
      }}
    >
      {children}
    </PluginDescriptorsContext.Provider>
  );
};
