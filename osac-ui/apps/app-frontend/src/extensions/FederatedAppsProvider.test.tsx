import { describe, expect, it, vi } from 'vitest';

import type { PluginDescriptor } from '@osac/extensions';

import { registerPluginRemotes } from './FederatedAppsProvider';

const descriptor = (id: string): PluginDescriptor => ({
  apiVersion: 'osac.ui.plugin.v1',
  id,
  name: id,
  extensions: [],
});

describe('registerPluginRemotes', () => {
  it('keeps healthy plugins when one remote registration fails and logs that plugin failure', () => {
    const registerRemote = vi.fn(({ name }: { name: string }) => {
      if (name === 'broken') {
        throw new Error('remote registration failed');
      }
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = registerPluginRemotes(
      [
        { descriptor: descriptor('healthy'), entryUrl: 'https://healthy.example/mf-manifest.json' },
        { descriptor: descriptor('broken'), entryUrl: 'https://broken.example/mf-manifest.json' },
      ],
      registerRemote,
    );

    expect(result.map(({ id }) => id)).toEqual(['healthy']);
    expect(registerRemote).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith('OSAC UI plugin failed', {
      pluginId: 'broken',
      stage: 'register remote',
      message: 'remote registration failed',
    });

    consoleError.mockRestore();
  });
});
