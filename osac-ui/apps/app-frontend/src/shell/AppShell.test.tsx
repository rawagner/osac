import { type ReactNode } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PluginDescriptorsContext } from '@osac/extensions';
import type { PluginDescriptor } from '@osac/extensions';
import { ServiceTier } from '@osac/types';
import type { UserRole } from '@osac/ui-components/shellTypes';
import { renderWithProviders } from '@osac/ui-components/test-utils/TestProviders';

vi.mock('./StorageRoutes', () => ({
  StorageRoutes: () => <h1>Storage routes</h1>,
}));

vi.mock('react-svg', () => ({
  ReactSVG: () => <svg aria-hidden="true" />,
}));

const pluginRouteThrows = vi.hoisted(() => ({ value: false }));
const pluginRouteLoadFails = vi.hoisted(() => ({ value: false }));
const loadRemote = vi.hoisted(() => vi.fn());

vi.mock('@module-federation/runtime', () => ({ loadRemote }));

const PluginRoute = () => {
  if (pluginRouteThrows.value) {
    throw new Error('private route failure');
  }
  return <h1>Plugin route</h1>;
};

import { AppShell } from './AppShell';

const TestPluginDescriptors = ({
  descriptors,
  children,
}: {
  descriptors: PluginDescriptor[];
  children: ReactNode;
}) => {
  return (
    <PluginDescriptorsContext.Provider value={{ descriptors, isLoading: false }}>
      {children}
    </PluginDescriptorsContext.Provider>
  );
};

const renderAppShell = (
  entry: string,
  role: UserRole = 'admin',
  enabledServices: ServiceTier[] = [ServiceTier.CAAS, ServiceTier.VMAAS, ServiceTier.BMAAS],
  descriptors: PluginDescriptor[] = [],
) =>
  renderWithProviders(
    <TestPluginDescriptors descriptors={descriptors}>
      <AppShell logout={vi.fn().mockResolvedValue(undefined)} />
    </TestPluginDescriptors>,
    {
      apiFixtures: {
        enabledServices,
        privateInstanceTypes: [],
        privateBaremetalInstanceTypes: [],
      },
      routerEntries: [entry],
      session: { role, tenantId: 'tenant-1' },
    },
  );

const pluginDescriptor: PluginDescriptor = {
  apiVersion: 'osac.ui.plugin.v1',
  id: 'inventory',
  name: 'Inventory',
  extensions: [
    {
      id: 'inventory:0',
      type: 'osac.ui.extension.v1.Route',
      properties: {
        path: '/extensions/inventory',
        component: { $codeRef: 'App' },
      },
    },
    {
      id: 'inventory:1',
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

describe('AppShell', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    pluginRouteThrows.value = false;
    pluginRouteLoadFails.value = false;
    loadRemote.mockReset();
    loadRemote.mockImplementation(() => {
      if (pluginRouteLoadFails.value) {
        return Promise.reject(new Error('private route import failure'));
      }
      return Promise.resolve({ default: PluginRoute });
    });
  });

  it('renders the storage route through the admin shell', async () => {
    renderAppShell('/admin/infrastructure/storage/backends');

    expect(await screen.findByRole('heading', { name: 'Storage routes' })).toBeInTheDocument();
  });

  it('renders the instance type list route through the admin shell', async () => {
    renderAppShell('/admin/infrastructure/instance-types');

    expect(await screen.findByRole('heading', { name: 'Instance types' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No instance types found')).toBeInTheDocument();
    });
  });

  it('renders the instance type create shell through the admin shell', async () => {
    renderAppShell('/admin/infrastructure/instance-types/create');

    expect(
      await screen.findByRole('heading', { name: 'Create instance type' }),
    ).toBeInTheDocument();
  });

  it('renders the bare metal instance type list route through the admin shell', async () => {
    renderAppShell('/admin/infrastructure/baremetal-instance-types');

    expect(
      await screen.findByRole('heading', { name: 'Bare metal instance types' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No bare metal instance types found')).toBeInTheDocument();
    });
  });

  it.each(['admin', 'tenant-idp-manager', 'tenant-admin', 'tenant-user'] as UserRole[])(
    'keeps a plugin route directly accessible to %s regardless of its navigation roles',
    async (role) => {
      renderAppShell('/extensions/inventory', role, undefined, [pluginDescriptor]);

      expect(await screen.findByRole('heading', { name: 'Plugin route' })).toBeInTheDocument();
    },
  );

  it('shows a safe route-local error when a plugin module import fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    pluginRouteLoadFails.value = true;

    renderAppShell('/extensions/inventory', 'tenant-user', undefined, [pluginDescriptor]);

    expect(await screen.findByText('Unexpected error occurred')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('OSAC UI plugin extension failed', {
      pluginId: 'inventory',
      extensionId: 'inventory:0',
      stage: 'load or render route extension',
      error: expect.objectContaining({ message: 'private route import failure' }) as Error,
    });
  });

  it('shows a safe route-local error when a plugin component render fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    pluginRouteThrows.value = true;

    renderAppShell('/extensions/inventory', 'tenant-user', undefined, [pluginDescriptor]);

    expect(await screen.findByText('Unexpected error occurred')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('OSAC UI plugin extension failed', {
      pluginId: 'inventory',
      extensionId: 'inventory:0',
      stage: 'load or render route extension',
      error: expect.objectContaining({ message: 'private route failure' }) as Error,
    });
  });

  it('does not render VM routes for admin — falls through to default', async () => {
    renderAppShell('/vms', 'admin');

    expect(screen.queryByRole('heading', { name: /virtual machines/i })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Tenants' })).toBeInTheDocument();
  });

  it('does not render cluster routes for admin — falls through to default', async () => {
    renderAppShell('/clusters', 'admin');

    expect(screen.queryByRole('heading', { name: /clusters/i })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Tenants' })).toBeInTheDocument();
  });

  it('does not render bare metal routes for admin — falls through to default', async () => {
    renderAppShell('/bare-metal', 'admin');

    expect(screen.queryByRole('heading', { name: /bare metal/i })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Tenants' })).toBeInTheDocument();
  });

  it('does not render volume routes for admin — falls through to default', async () => {
    renderAppShell('/storage/volumes', 'admin');

    expect(screen.queryByRole('heading', { name: /volumes/i })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Tenants' })).toBeInTheDocument();
  });

  it('does not render volume routes for tenant-user — falls through to default', async () => {
    renderAppShell('/storage/volumes', 'tenant-user');

    expect(screen.queryByRole('heading', { name: /volumes/i })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Catalog' })).toBeInTheDocument();
  });

  it('does not register catalog create route for tenant-user', async () => {
    renderAppShell('/catalog/vm/create', 'tenant-user');

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Create VM Catalog Item' }),
      ).not.toBeInTheDocument();
    });
  });

  it('does not register catalog edit route for tenant-user', async () => {
    renderAppShell('/catalog/vm/item-1/edit', 'tenant-user');

    expect(await screen.findByRole('heading', { name: 'Catalog' })).toBeInTheDocument();
  });

  it.each([
    '/catalog/vms/item-1/launch',
    '/catalog/clusters/item-1/launch',
    '/catalog/bare-metal/item-1/launch',
  ])('does not register catalog launch route for admin: %s', async (path) => {
    renderAppShell(path, 'admin');

    expect(await screen.findByRole('heading', { name: 'Tenants' })).toBeInTheDocument();
  });

  it.each(['tenant-admin', 'tenant-user'] as const)(
    'registers the VM catalog launch route for %s',
    async (role) => {
      renderAppShell('/catalog/vms/item-1/launch', role);

      expect(
        await screen.findByRole('heading', { name: 'VM catalog item not found' }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    { path: '/catalog/vms/item-1', title: 'VM catalog item not found' },
    { path: '/catalog/clusters/item-1', title: 'Cluster catalog item not found' },
    { path: '/catalog/bare-metal/item-1', title: 'Bare metal catalog item not found' },
  ])('routes $path to its resource-specific catalog detail page', async ({ path, title }) => {
    renderAppShell(path);

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  it.each([
    {
      path: '/vms/vm-1',
      service: ServiceTier.VMAAS,
      label: 'Virtual Machine',
    },
    {
      path: '/clusters/cluster-1',
      service: ServiceTier.CAAS,
      label: 'Cluster',
    },
    {
      path: '/bare-metal/instance-1',
      service: ServiceTier.BMAAS,
      label: 'Bare Metal',
    },
    {
      path: '/catalog/vms',
      service: ServiceTier.VMAAS,
      label: 'Virtual Machine',
    },
    {
      path: '/catalog/vms/item-1',
      service: ServiceTier.VMAAS,
      label: 'Virtual Machine',
    },
    {
      path: '/catalog/clusters/item-1/launch',
      service: ServiceTier.CAAS,
      label: 'Cluster',
    },
    {
      path: '/catalog/bare-metal',
      service: ServiceTier.BMAAS,
      label: 'Bare Metal',
    },
  ])(
    'shows a service-unavailable page for a disabled $label route',
    async ({ path, service, label }) => {
      renderAppShell(
        path,
        'tenant-user',
        [ServiceTier.CAAS, ServiceTier.VMAAS, ServiceTier.BMAAS].filter(
          (enabledService) => enabledService !== service,
        ),
      );

      expect(
        await screen.findByRole('heading', { name: 'Service unavailable' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(`The ${label} service is not enabled on this server.`),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to catalog' })).toBeInTheDocument();
    },
  );
});
