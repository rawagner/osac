import { type ComponentType, lazy, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import type { CodeRef } from '@osac/extensions';
import ErrorBoundary from '@osac/ui-components/components/ErrorBoundary/ErrorBoundary';

type LazyComponentProps<P extends object> = {
  codeRef: CodeRef<ComponentType<P>>;
  componentProps: P;
  pluginId: string;
  extensionId: string;
};

const LazyComponent = <P extends object>({
  codeRef,
  componentProps,
  pluginId,
  extensionId,
}: LazyComponentProps<P>) => {
  const { pathname } = useLocation();
  const Component = useMemo(
    () =>
      lazy(async () => ({
        default: await codeRef(),
      })),
    [codeRef],
  );

  return (
    <ErrorBoundary
      key={pathname}
      onError={(error) => {
        // eslint-disable-next-line no-console -- plugin extension failures need browser diagnostics
        console.error('OSAC UI plugin extension failed', {
          pluginId,
          extensionId,
          stage: 'load or render route extension',
          error,
        });
      }}
    >
      <Component {...componentProps} />
    </ErrorBoundary>
  );
};

export default LazyComponent;
