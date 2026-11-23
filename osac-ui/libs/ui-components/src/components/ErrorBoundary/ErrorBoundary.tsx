import React from 'react';
import { Alert } from '@patternfly/react-core';

import { getErrorMessage } from '../../utils/error';

interface State {
  hasError: boolean;
  error: Error;
  info: React.ErrorInfo;
}

type ErrorBoundaryProps = React.PropsWithChildren<{
  fallback?: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}>;

class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  state = {
    hasError: false,
    error: { message: '', stack: '' } as Error,
    info: { componentStack: '' },
  };

  static getDerivedStateFromError = (/* error */) => {
    return { hasError: true };
  };

  componentDidCatch = (error: Error, info: React.ErrorInfo) => {
    this.props.onError?.(error, info);
    this.setState({ error, info });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;
    if (!hasError && !children) {
      return null;
    }

    if (!hasError) {
      return children;
    }
    if (fallback !== undefined) {
      return fallback;
    }

    return (
      <Alert variant="danger" title="Unexpected error occurred" isInline>
        Please reload the page and try again
        <details>{getErrorMessage(error)}</details>
      </Alert>
    );
  }
}

export default ErrorBoundary;
