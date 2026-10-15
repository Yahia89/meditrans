import React from 'react';
import { Button } from '@/components/ui/button';
import { isChunkLoadError } from '@/lib/chunk-errors';
import { getErrorDiagnostic } from '@/lib/error-diagnostics';

interface Props {
    children: React.ReactNode;
    fallbackTitle?: string;
    onRetry?: () => void | Promise<unknown>;
}

interface State {
    hasError: boolean;
    error?: Error;
    retrying: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
    private mounted = false;

    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, retrying: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, retrying: false };
    }

    componentDidMount() { this.mounted = true; }
    componentWillUnmount() { this.mounted = false; }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        const diagnostic = getErrorDiagnostic(error, errorInfo.componentStack);
        console.error('UI boundary diagnostic', import.meta.env.DEV ? diagnostic : { reference: diagnostic.reference, kind: diagnostic.kind });
    }

    private retry = async () => {
        if (this.state.retrying) return;
        this.setState({ retrying: true });
        try {
            await this.props.onRetry?.();
            if (this.mounted) this.setState({ hasError: false, error: undefined, retrying: false });
        } catch (error) {
            const diagnostic = getErrorDiagnostic(error);
            console.error('UI retry diagnostic', import.meta.env.DEV ? diagnostic : { reference: diagnostic.reference, kind: diagnostic.kind });
            if (this.mounted) this.setState({ retrying: false });
        }
    };

    render() {
        if (this.state.hasError) {
            const chunkFailed = isChunkLoadError(this.state.error);
            const diagnostic = getErrorDiagnostic(this.state.error);
            return (
                <div role="alert" aria-busy={this.state.retrying} className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                        {chunkFailed ? 'This page could not load' : this.props.fallbackTitle || 'Something went wrong'}
                    </h2>
                    <p className="text-slate-500 mb-4 max-w-md">
                        {chunkFailed
                            ? 'Check your connection and try again. If this continues, save any unfinished work and refresh to load the current version.'
                            : 'This page encountered an unexpected error. Try again, or open another page from the sidebar.'}
                    </p>
                    <p className="mb-4 text-xs text-slate-500">Reference: {diagnostic.reference}</p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button onClick={() => void this.retry()} disabled={this.state.retrying}>
                            {this.state.retrying ? 'Trying again…' : 'Try again'}
                        </Button>
                        {chunkFailed && <Button onClick={() => window.location.reload()} variant="outline">Refresh page</Button>}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
