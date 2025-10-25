import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
  componentName?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  componentStack?: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
      componentStack: errorInfo.componentStack
    });

    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log to error tracking service (can be extended with Sentry, etc.)
    this.logErrorToService(error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Show toast notification
    toast.error(`Something went wrong in ${this.props.componentName || 'component'}`, {
      description: error.message,
      duration: 5000,
    });
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // This is where you would integrate with error tracking services like:
    // - Sentry
    // - LogRocket  
    // - Datadog
    // - Custom error logging API
    
    const errorData = {
      error: error.toString(),
      component: this.props.componentName || 'Unknown',
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    console.log('Error logged to service:', errorData);
    
    // Example: Send to backend API
    // fetch('/api/error-log', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorData),
    // });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-6 w-6" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                {this.props.componentName && (
                  <span>Error in {this.props.componentName}</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">Error details:</p>
                <code className="block p-3 bg-muted rounded text-xs overflow-x-auto">
                  {this.state.error?.message || 'Unknown error occurred'}
                </code>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={this.handleReset}
                  className="w-full"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                
                <Button
                  onClick={this.handleReload}
                  className="w-full"
                  variant="outline"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Reload Application
                </Button>
              </div>

              {/* Debug information (visible in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Technical details</summary>
                  <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for programmatic navigation
export const useErrorHandler = () => {
  const navigate = useNavigate();

  const handleError = (error: Error, context?: string) => {
    console.error(`Error in ${context || 'unknown context'}:`, error);
    toast.error(`Error: ${error.message}`, {
      description: context ? `Context: ${context}` : undefined,
    });
  };

  const navigateWithErrorHandling = (to: string) => {
    try {
      navigate(to);
    } catch (error) {
      handleError(error as Error, `Navigation to ${to}`);
    }
  };

  return { handleError, navigateWithErrorHandling };
};

export default ErrorBoundary;