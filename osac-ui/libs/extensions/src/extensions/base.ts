import type { PluginContextProviderExtension } from './context';
import type { PluginNavigationLinkExtension, PluginNavigationSectionExtension } from './navigation';
import type { PluginRouteExtension } from './route';

export type PluginExtension =
  | PluginRouteExtension
  | PluginNavigationSectionExtension
  | PluginNavigationLinkExtension
  | PluginContextProviderExtension;
