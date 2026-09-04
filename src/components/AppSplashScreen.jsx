// src/components/AppSplashScreen.jsx
//
// The one and only "app is still starting up" visual, used both here (React
// state resolving - e.g. Firebase's initial auth check) and, in static
// HTML+CSS form, directly in index.html for the moment BEFORE React has even
// mounted (bundle download/parse/execute). Deliberately kept pixel-identical
// to that static markup (same logo, wordmark, colors, animation) so the
// hand-off from "static HTML splash" to "this component" is invisible - the
// whole point of having both is that neither one is ever the visible seam.
const AppSplashScreen = () => (
    <div style={{
        minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '20px',
        background: '#0F0F17', animation: 'nexusSplashFadeIn 0.25s ease',
    }}>
        <div style={{ position: 'relative', width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
                position: 'absolute', inset: '-14px', borderRadius: '24px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, rgba(99,102,241,0) 70%)',
                animation: 'nexusSplashGlow 1.8s ease-in-out infinite',
            }} />
            <img src="/nexus-logo.svg" alt="Nexus" style={{ width: '64px', height: '64px', objectFit: 'contain', position: 'relative' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '1.2px', color: '#fff', margin: 0 }}>NEXUS</h1>
            <p style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '700', marginTop: '4px' }}>OS</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            {[0, 1, 2].map((i) => (
                <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%', background: '#818CF8',
                    animation: `nexusSplashDot 1.2s ease-in-out ${i * 0.15}s infinite`,
                }} />
            ))}
        </div>
        <style>{`
            @keyframes nexusSplashFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes nexusSplashGlow { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
            @keyframes nexusSplashDot { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }
        `}</style>
    </div>
);

export default AppSplashScreen;
