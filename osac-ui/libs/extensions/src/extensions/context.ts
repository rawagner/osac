import type { ComponentType, PropsWithChildren } from 'react';

import type { EncodedCodeRef } from '../code-ref';
import type { PluginExtension } from './base';

export type PluginContextProviderExtension = {
  type: 'osac.ui.extension.v1.ContextProvider';
  properties: {
    component: EncodedCodeRef<ComponentType<PropsWithChildren>>;
  };
};

export const isContextProvider = (
  extension: PluginExtension,
): extension is PluginContextProviderExtension =>
  extension.type === 'osac.ui.extension.v1.ContextProvider';
