import type { ComponentType } from 'react';

import type { EncodedCodeRef } from '../code-ref';
import type { PluginExtension } from './base';

export type PluginRouteExtension = {
  type: 'osac.ui.extension.v1.Route';
  properties: {
    path: string;
    component: EncodedCodeRef<ComponentType>;
  };
};

export const isRoute = (extension: PluginExtension): extension is PluginRouteExtension =>
  extension.type === 'osac.ui.extension.v1.Route';
