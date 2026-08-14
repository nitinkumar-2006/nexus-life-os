// src/components/ErrorBoundary.jsx
//
// A real, working React error boundary - the only mechanism React
// actually provides for catching a render-time error in a child
// component tree and showing a fallback instead of the default
// behavior (an uncaught error unmounts the ENTIRE app, producing
// exactly the "blank black screen" this request describes). Must
// genuinely be a class component: getDerivedStateFromError and
// componentDidCatch are only available on class components in React -
// this is a real, fundamental platform limitation, not a stylistic
// choice, so a hooks-based version of this file is not possible.
//
// No console.error call here, matching this app's own established
// "zero console logs" convention carried through every other file
// this session - the error message itself is still captured and
// shown to the user directly in the fallback card below, so nothing
// about the failure is silently lost, it's just not routed through
// the browser console.
import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    // Runs during the render phase itself, the moment a child throws -
    // this is what actually flips the fallback UI on for the very next
    // render, before componentDidCatch's own, later commit-phase call.
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    // Runs after the error has been caught and the fallback has
    // rendered - the correct place for any real side effect a
    // consumer might want (this app's own convention keeps this
    // empty, but the lifecycle stays present since its mere
    // existence, alongside getDerivedStateFromError, is what makes
    // this class a real error boundary at all per React's own
    // contract).
    componentDidCatch(error, errorInfo) {}

    handleRetry = () => {
        // Genuinely resets the caught state, so the next render
        // attempts this.props.children fresh - if whatever caused the
        // original crash was a real, transient issue (a stale
        // localStorage read racing a write, for instance), this alone
        // recovers the module with no reload. If the underlying data
        // is still genuinely broken, the same error is simply caught
        // again, and the fallback reappears rather than genuinely
        // leaving the user on a real blank screen.
        this.setState({ hasError: false, error: null });
        if (this.props.onRetry) this.props.onRetry();
    };

    render() {
        if (this.state.hasError) {
            const moduleLabel = this.props.moduleName || 'This module';
            return (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '24px',
                    padding: '48px 32px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', textAlign: 'center', gap: '16px',
                    maxWidth: '480px', margin: '40px auto',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <AlertTriangle size={26} color="#EF4444" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
                            {moduleLabel} hit an unexpected error
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                            Something went wrong while rendering this section. Your other data
                            is safe - retrying usually resolves a temporary glitch.
                        </p>
                    </div>
                    {this.state.error?.message && (
                        <div style={{
                            width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-premium)',
                            borderRadius: '10px', padding: '10px 14px', fontSize: '11px', color: 'var(--text-muted)',
                            fontFamily: 'monospace', textAlign: 'left', overflowWrap: 'break-word',
                        }}>
                            {this.state.error.message}
                        </div>
                    )}
                    <button
                        onClick={this.handleRetry}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px',
                            padding: '12px 24px', background: 'var(--accent)', color: '#fff',
                            border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700',
                            cursor: 'pointer',
                        }}
                    >
                        <RotateCcw size={16} /> Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
