'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { useI18n } from '@/i18n/I18nProvider';
import { queryClient } from '@/lib/queryClient';

class ErrorBoundaryInner extends React.Component<{ children: React.ReactNode; title: string; description: string; retryLabel: string }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title={this.props.title}
          description={this.props.description}
          action={{
            label: this.props.retryLabel,
            onClick: () => {
              queryClient.clear();
              this.setState({ hasError: false });
            },
          }}
        />
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <ErrorBoundaryInner
      title={t('errors.genericTitle')}
      description={t('errors.genericDescription')}
      retryLabel={t('common.actions.retry')}
    >
      {children}
    </ErrorBoundaryInner>
  );
}
