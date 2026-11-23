import { type ReactNode } from 'react';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PluginDescriptorsContext } from '@osac/extensions';
import type { PluginDescriptor } from '@osac/extensions';
import { renderWithProviders } from '@osac/ui-components/test-utils/TestProviders';

const loadRemote = vi.hoisted(() => vi.fn());

vi.mock('@module-federation/runtime', () => ({ loadRemote }));

import { FederatedContextProviders } from './FederatedContextProviders';

const Provider = ({ children }: { children: ReactNode }) => (
  <section data-testid="healthy-provider">{children}</section>
);

const descriptors: PluginDescriptor[] = [
  {
    apiVersion: 'osac.ui.plugin.v1',
    id: 'broken-plugin',
    name: 'Broken plugin',
    extensions: [
      {
        id: 'broken-plugin:0',
        type: 'osac.ui.extension.v1.ContextProvider',
        properties: { component: { $codeRef: 'Context' } },
      },
    ],
  },
  {
    apiVersion: 'osac.ui.plugin.v1',
    id: 'healthy-plugin',
    name: 'Healthy plugin',
    extensions: [
      {
        id: 'healthy-plugin:0',
        type: 'osac.ui.extension.v1.ContextProvider',
        properties: { component: { $codeRef: 'Context' } },
      },
    ],
  },
];

describe('FederatedContextProviders', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    loadRemote.mockReset();
  });

  it('skips a failed provider import while rendering healthy siblings and children', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loadRemote.mockImplementation((specifier: string) => {
      if (specifier.startsWith('broken-plugin/')) {
        return Promise.reject(new Error('sensitive remote detail'));
      }
      return Promise.resolve({ default: Provider });
    });

    renderWithProviders(
      <PluginDescriptorsContext.Provider value={{ descriptors, isLoading: false }}>
        <FederatedContextProviders>
          <main>Application content</main>
        </FederatedContextProviders>
      </PluginDescriptorsContext.Provider>,
    );

    expect(await screen.findByText('Application content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('healthy-provider')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('OSAC UI context provider failed', {
      pluginId: 'broken-plugin',
      extensionId: 'broken-plugin:0',
      stage: 'resolve extension module',
      message: 'sensitive remote detail',
    });
  });

  it('skips a provider that throws while rendering healthy siblings and children', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loadRemote.mockImplementation((specifier: string) => {
      if (specifier.startsWith('broken-plugin/')) {
        return Promise.resolve({
          default: () => {
            throw new Error('private provider failure');
          },
        });
      }
      return Promise.resolve({ default: Provider });
    });

    renderWithProviders(
      <PluginDescriptorsContext.Provider value={{ descriptors, isLoading: false }}>
        <FederatedContextProviders>
          <main>Application content</main>
        </FederatedContextProviders>
      </PluginDescriptorsContext.Provider>,
    );

    expect(await screen.findByTestId('healthy-provider')).toBeInTheDocument();
    expect(screen.getByText('Application content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('OSAC UI context provider failed', {
      pluginId: 'broken-plugin',
      extensionId: 'broken-plugin:0',
      stage: 'render context provider',
      error: expect.objectContaining({ message: 'private provider failure' }) as Error,
    });
  });
});
