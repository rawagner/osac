import { describe, expect, it } from 'vitest';

import { parsePluginDescriptor } from './plugin-descriptor';

const validDescriptor = {
  apiVersion: 'osac.ui.plugin.v1',
  id: 'inventory',
  name: 'Inventory',
  extensions: [
    {
      type: 'osac.ui.extension.v1.Route',
      properties: {
        path: '/extensions/inventory',
        component: { $codeRef: 'InventoryPage' },
      },
    },
    {
      type: 'osac.ui.extension.v1.NavigationLink',
      properties: {
        id: 'inventory',
        label: 'Inventory',
        path: '/extensions/inventory',
        allowedRoles: ['tenant-admin'],
      },
    },
  ],
};

describe('parsePluginDescriptor', () => {
  it('accepts a descriptor matching the configured plugin ID', () => {
    expect(parsePluginDescriptor(JSON.stringify(validDescriptor), 'inventory')).toEqual(
      validDescriptor,
    );
  });

  it('rejects invalid JSON', () => {
    expect(() => parsePluginDescriptor('{', 'inventory')).toThrow('valid JSON');
  });

  it.each([null, [], 'descriptor', 42])('rejects a non-object descriptor: %s', (value) => {
    expect(() => parsePluginDescriptor(JSON.stringify(value), 'inventory')).toThrow(
      'descriptor object',
    );
  });

  it('rejects an unsupported API version', () => {
    expect(() =>
      parsePluginDescriptor(
        JSON.stringify({ ...validDescriptor, apiVersion: 'osac.ui.plugin.v2' }),
        'inventory',
      ),
    ).toThrow('apiVersion');
  });

  it('rejects a descriptor whose ID differs from the configured plugin ID', () => {
    expect(() => parsePluginDescriptor(JSON.stringify(validDescriptor), 'orders')).toThrow(
      'configured plugin ID',
    );
  });

  it('requires the descriptor name and an extensions array', () => {
    expect(() =>
      parsePluginDescriptor(JSON.stringify({ ...validDescriptor, name: 1 }), 'inventory'),
    ).toThrow('name');
    expect(() =>
      parsePluginDescriptor(JSON.stringify({ ...validDescriptor, extensions: {} }), 'inventory'),
    ).toThrow('extensions');
  });

  it('requires package-qualified extension types with object properties', () => {
    expect(() =>
      parsePluginDescriptor(
        JSON.stringify({
          ...validDescriptor,
          extensions: [{ type: 'osac.ui.extension.v1.', properties: {} }],
        }),
        'inventory',
      ),
    ).toThrow('extension type');
    expect(() =>
      parsePluginDescriptor(
        JSON.stringify({
          ...validDescriptor,
          extensions: [{ type: 'v1alpha1.osac/route', properties: {} }],
        }),
        'inventory',
      ),
    ).toThrow('extension type');
    expect(() =>
      parsePluginDescriptor(
        JSON.stringify({
          ...validDescriptor,
          extensions: [{ type: 'osac.ui.extension.v1.Route', properties: [] }],
        }),
        'inventory',
      ),
    ).toThrow('properties');
  });
});
