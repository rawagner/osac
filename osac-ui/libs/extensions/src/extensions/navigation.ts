import type { PluginExtension } from './base';

export type PluginRole = 'admin' | 'tenant-idp-manager' | 'tenant-admin' | 'tenant-user';

const pluginRoles: PluginRole[] = ['admin', 'tenant-idp-manager', 'tenant-admin', 'tenant-user'];

const isPluginRole = (role: unknown): role is PluginRole =>
  typeof role === 'string' && pluginRoles.includes(role as PluginRole);

export const navigationRoleAllowed = (
  allowedRoles: PluginRole[] | undefined,
  role: PluginRole,
): boolean => {
  if (allowedRoles === undefined) {
    return true;
  }
  return (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    allowedRoles.every(isPluginRole) &&
    allowedRoles.includes(role)
  );
};

export type PluginNavigationSectionExtension = {
  type: 'osac.ui.extension.v1.NavigationSection';
  properties: {
    id: string;
    label: string;
  };
};

export type PluginNavigationLinkExtension = {
  type: 'osac.ui.extension.v1.NavigationLink';
  properties: {
    id: string;
    label: string;
    path: string;
    section?: string;
    allowedRoles?: PluginRole[];
  };
};

export const isNavSection = (
  extension: PluginExtension,
): extension is PluginNavigationSectionExtension =>
  extension.type === 'osac.ui.extension.v1.NavigationSection';

export const isNavLink = (extension: PluginExtension): extension is PluginNavigationLinkExtension =>
  extension.type === 'osac.ui.extension.v1.NavigationLink';
