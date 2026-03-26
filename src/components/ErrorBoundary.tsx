import React from 'react';
import { TranslatedText } from './TranslatedText';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  info?: { componentStack: string };
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log detailed error for debugging
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', info?.componentStack);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-2">
              <TranslatedText text="Something went wrong" targetLanguage="en" />
            </h1>
            <p className="text-muted-foreground mb-4">
              <TranslatedText text="Please refresh the page. We've logged the error to the console." targetLanguage="en" />
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
