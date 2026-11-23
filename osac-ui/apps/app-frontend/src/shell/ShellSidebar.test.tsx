import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PluginDescriptorsContext } from '@osac/extensions';
import type { PluginDescriptor, PluginRole } from '@osac/extensions';
import type { UserRole } from '@osac/ui-components/shellTypes';
import { renderWithProviders } from '@osac/ui-components/test-utils/TestProviders';

import { ShellSidebar } from './ShellSidebar';

const recognizedRoles: UserRole[] = ['admin', 'tenant-idp-manager', 'tenant-admin', 'tenant-user'];

const pluginDescriptor = (allowedRoles?: PluginRole[]): PluginDescriptor => ({
  apiVersion: 'osac.ui.plugin.v1',
  id: 'inventory',
  name: 'Inventory',
  extensions: [
    {
      id: 'inventory:0',
      type: 'osac.ui.extension.v1.NavigationLink',
      properties: {
        id: 'inventory',
        label: 'Inventory',
        path: '/extensions/inventory',
        ...(allowedRoles === undefined ? {} : { allowedRoles }),
      },
    },
    {
      id: 'inventory:1',
      type: 'osac.ui.extension.v1.NavigationLink',
      properties: {
        id: 'inventory-public',
        label: 'Public plugin page',
        path: '/extensions/public',
      },
    },
  ],
});

const renderSidebar = (role: UserRole, allowedRoles?: PluginRole[]) =>
  renderWithProviders(
    <PluginDescriptorsContext.Provider
      value={{
        descriptors: [pluginDescriptor(allowedRoles)],
        isLoading: false,
      }}
    >
      <ShellSidebar />
    </PluginDescriptorsContext.Provider>,
    { routerEntries: ['/'], session: { role, tenantId: 'tenant-1' } },
  );

describe('ShellSidebar plugin navigation roles', () => {
  it.each(recognizedRoles)('shows a link with omitted allowedRoles for %s', (role) => {
    renderSidebar(role, undefined);

    expect(screen.getByRole('link', { name: 'Inventory' })).toBeInTheDocument();
  });

  it.each(recognizedRoles)('shows a link for an allowed %s role', (role) => {
    renderSidebar(role, [role]);

    expect(screen.getByRole('link', { name: 'Inventory' })).toBeInTheDocument();
  });

  it('hides a denied plugin link while keeping built-in navigation visible', () => {
    renderSidebar('tenant-user', ['admin']);

    expect(screen.queryByRole('link', { name: 'Inventory' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Public plugin page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument();
  });

  it.each([
    { name: 'empty list', roles: [] },
    { name: 'unknown role', roles: ['tenant-user', 'unexpected-role'] },
    { name: 'only unknown role', roles: ['unexpected-role'] },
  ])('hides the link for an $name policy without hiding built-in navigation', ({ roles }) => {
    renderSidebar('tenant-user', roles as PluginRole[]);

    expect(screen.queryByRole('link', { name: 'Inventory' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Public plugin page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument();
  });
});
