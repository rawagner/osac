import { createContext } from 'react';

import type { PluginDescriptor } from './plugin-descriptor';

type PluginDescriptorsState = {
  descriptors: PluginDescriptor[];
  isLoading: boolean;
};

const EMPTY_PLUGIN_DESCRIPTORS: PluginDescriptor[] = [];

export const PluginDescriptorsContext = createContext<PluginDescriptorsState>({
  descriptors: EMPTY_PLUGIN_DESCRIPTORS,
  isLoading: false,
});
