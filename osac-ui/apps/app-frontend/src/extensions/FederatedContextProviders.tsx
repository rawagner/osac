import { type ReactNode, Suspense, useEffect } from 'react';
import { Spinner } from '@patternfly/react-core';

import { isContextProvider, useResolvedExtensions } from '@osac/extensions';
import ErrorBoundary from '@osac/ui-components/components/ErrorBoundary/ErrorBoundary';
import { useTranslation } from '@osac/ui-components/hooks/useTranslation';

export interface FederatedContextProvidersProps {
  children?: ReactNode;
}

export const FederatedContextProviders = ({ children }: FederatedContextProvidersProps) => {
  const { t } = useTranslation();
  const [providers, extensionsLoading, errors] = useResolvedExtensions(isContextProvider);

  useEffect(() => {
    errors?.forEach((error) => {
      // eslint-disable-next-line no-console
      console.error('OSAC UI context provider failed', error);
    });
  }, [errors]);

  if (extensionsLoading) {
    return <Spinner aria-label={t('Loading extensions')} />;
  }

  const content = providers.reduceRight<ReactNode>((nested, provider) => {
    const Component = provider.properties.component;
    return (
      <ErrorBoundary
        key={provider.id}
        fallback={nested}
        onError={(error) => {
          // eslint-disable-next-line no-console
          console.error('OSAC UI context provider failed', {
            pluginId: provider.pluginId,
            extensionId: provider.id,
            stage: 'render context provider',
            error,
          });
        }}
      >
        <Component>{nested}</Component>
      </ErrorBoundary>
    );
  }, children);

  return <Suspense fallback={<Spinner aria-label={t('Loading extensions')} />}>{content}</Suspense>;
};
