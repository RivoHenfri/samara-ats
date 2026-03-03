import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', padding: 40, textAlign: 'center' }}>
                    <AlertTriangle size={48} style={{ color: 'var(--alert)', marginBottom: 16 }} />
                    <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--alert)', marginBottom: 8 }}>Something went wrong</h2>
                    <p style={{ color: 'var(--stone)', fontSize: 14, maxWidth: 400, marginBottom: 24, lineHeight: 1.5 }}>
                        An unexpected error occurred while rendering this module. Our team has been notified.
                        Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn btn-primary"
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
