// src/components/sidebar.jsx
import React, { useState, useEffect } from 'react';
import { 
    Command, CheckSquare, BookOpen, Dumbbell, Apple, 
    Wallet, Calendar, BarChart2, Cpu, FileText, User, Settings, Clock, PanelLeftClose, PanelLeftOpen, X 
} from 'lucide-react';
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';

const NexusSidebarComponent = ({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, isMobile, isMobileNavOpen, setIsMobileNavOpen }) => {
    const { tabSwitch } = useMicroFeedback();
    // A real, single, central place every nav click routes through - so
    // every entry point into a tab switch (the main nav list AND the
    // dedicated Settings button below) gets the same feedback without
    // needing to be wired individually at each call site.
    const handleNavClick = (tabName) => {
        tabSwitch();
        setActiveTab(tabName);
    };

    // State to hold which modules are currently active from Settings
    const [activeModules, setActiveModules] = useState({});

    // Function to load settings from LocalStorage
    const loadSettings = () => {
        try {
            const settings = JSON.parse(localStorage.getItem('nexus_global_settings')) || {};
            // If settings exist, use them, otherwise default to all true
            setActiveModules(settings.activeModules || {
                planner: true, study: true, gym: true, diet: true, finance: true, calendar: true, analytics: true, ai: true
            });
        } catch (e) {
            console.error("Failed to load sidebar settings", e);
        }
    };

    // Listen for real-time updates when Settings are saved or Reset
    useEffect(() => {
        loadSettings();
        window.addEventListener('nexus_settings_updated', loadSettings);
        window.addEventListener('storage', loadSettings); // Syncs when cache is cleared
        
        return () => {
            window.removeEventListener('nexus_settings_updated', loadSettings);
            window.removeEventListener('storage', loadSettings);
        };
    }, []);

    // Full Navigation List with IDs matching the Settings Module Manager
    const allNavItems = [
        { name: 'Home', id: 'home', icon: <Command size={22} />, essential: true },
        { name: 'Planner', id: 'planner', icon: <CheckSquare size={22} /> },
        { name: 'Daily Table', id: 'dailytable', icon: <Clock size={22} />, essential: true },
        { name: 'Study', id: 'study', icon: <BookOpen size={22} /> },
        { name: 'Syllabus', id: 'syllabus', icon: <FileText size={22} />, essential: true },
        { name: 'Gym', id: 'gym', icon: <Dumbbell size={22} /> },
        { name: 'Diet', id: 'diet', icon: <Apple size={22} /> },
        { name: 'Finance', id: 'finance', icon: <Wallet size={22} /> },
        { name: 'Calendar', id: 'calendar', icon: <Calendar size={22} /> },
        { name: 'Analytics', id: 'analytics', icon: <BarChart2 size={22} /> },
        { name: 'AI', id: 'ai', icon: <Cpu size={22} /> },
        { name: 'Profile', id: 'profile', icon: <User size={22} />, essential: true },
    ];

    // Filter items: Only show if it's essential OR if it's turned ON in Settings
    const visibleNavItems = allNavItems.filter(item => {
        if (item.essential) return true;
        return activeModules[item.id] !== false; // Show by default unless strictly false
    });

    // On mobile, the drawer always shows full labels when open - a
    // 260px-wide drawer rendered in the icons-only visual state would
    // waste most of its own real width and look genuinely broken. The
    // desktop-only isCollapsed preference simply doesn't apply here.
    const effectivelyCollapsed = isCollapsed && !isMobile;

    return (
        <aside className="sidebar" style={isMobile ? {
            // Real, separate mobile drawer styling - completely distinct
            // from the desktop object below, so nothing here can ever
            // leak into or alter the desktop path.
            position: 'fixed', top: 0, left: 0, height: '100vh', width: '260px', zIndex: 100,
            background: 'var(--sidebar-bg)',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '28px 16px 20px 16px',
            overflowY: 'auto',
            transform: isMobileNavOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        } : {
            width: isCollapsed ? '76px' : '224px', 
            background: 'var(--sidebar-bg)', 
            /* backdrop-filter intentionally NOT set inline here - the external
               stylesheet rule matching [style*="var(--sidebar-bg)"] applies it
               (blur + saturate + brightness). An inline declaration would
               override that rule and silently strip out the saturate/
               brightness boost, which is exactly what was causing the
               sidebar to look flatter/muddier than elements without an
               inline backdrop-filter (like the Quick Add popup). */
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', 
            padding: isCollapsed ? '28px 12px 20px 12px' : '28px 16px 20px 16px', 
            flexShrink: 0, height: '100vh', overflowY: 'auto',
            transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
            <div>
                {/* Logo & Expand/Collapse Toggle */}
                <div className="sidebar-header" style={{ 
                    display: 'flex',
                    flexDirection: effectivelyCollapsed ? 'column' : 'row',
                    alignItems: 'center', 
                    justifyContent: effectivelyCollapsed ? 'center' : 'space-between', 
                    gap: effectivelyCollapsed ? '14px' : '0',
                    marginBottom: '32px', paddingLeft: effectivelyCollapsed ? '0' : '8px' 
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '42px', height: '42px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img
                                src="/nexus-logo.png"
                                alt="Nexus"
                                style={{
                                    width: effectivelyCollapsed ? '34px' : '40px',
                                    height: effectivelyCollapsed ? '34px' : '40px',
                                    objectFit: 'contain',
                                    background: 'transparent',
                                    borderRadius: '10px',
                                    transition: 'width 0.2s ease, height 0.2s ease',
                                }}
                            />
                        </div>
                        {!effectivelyCollapsed && (
                            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                <h2 style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '1.2px', color: '#fff', margin: 0 }}>NEXUS</h2>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '700', marginTop: '2px' }}>Life OS</p>
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => (isMobile ? setIsMobileNavOpen(false) : setIsCollapsed(!isCollapsed))}
                        style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: '#fff', cursor: 'pointer', transition: 'var(--transition)'
                        }}
                        title={isMobile ? 'Close menu' : (isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar')}
                    >
                        {isMobile ? <X size={17} /> : (isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />)}
                    </button>
                </div>

                {/* Dynamic Navigation Links */}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: effectivelyCollapsed ? 'center' : 'stretch' }}>
                    {visibleNavItems.map((item, index) => (
                        <button 
                            key={index} 
                            onClick={() => { handleNavClick(item.name); if (isMobile) setIsMobileNavOpen(false); }}
                            title={effectivelyCollapsed ? item.name : ''}
                            style={{
                                display: 'flex', alignItems: 'center', 
                                justifyContent: effectivelyCollapsed ? 'center' : 'flex-start',
                                gap: '14px', padding: effectivelyCollapsed ? '13px' : '13px 14px',
                                color: activeTab === item.name ? '#fff' : 'var(--text-muted)',
                                borderRadius: '14px', fontWeight: '700', fontSize: '16px',
                                background: activeTab === item.name ? 'rgba(99,102,241,0.2)' : 'transparent',
                                border: activeTab === item.name ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                                width: effectivelyCollapsed ? '52px' : '100%', cursor: 'pointer', transition: 'var(--transition)'
                            }}
                            onMouseEnter={(e) => { if (activeTab !== item.name) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                            onMouseLeave={(e) => { if (activeTab !== item.name) e.currentTarget.style.background = 'transparent' }}
                        >
                            <span style={{ color: activeTab === item.name ? 'var(--primary, #6366f1)' : 'inherit', display: 'flex' }}>
                                {item.icon} 
                            </span>
                            {!effectivelyCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.name}</span>}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Bottom Footer Section: Settings */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', marginTop: '20px', display: 'flex', justifyContent: effectivelyCollapsed ? 'center' : 'stretch' }}>
                <button 
                    onClick={() => { handleNavClick('Settings'); if (isMobile) setIsMobileNavOpen(false); }} 
                    title={effectivelyCollapsed ? "Settings" : ""}
                    style={{ 
                        display: 'flex', alignItems: 'center', 
                        justifyContent: effectivelyCollapsed ? 'center' : 'flex-start',
                        gap: '14px', padding: effectivelyCollapsed ? '12px' : '12px 14px', 
                        color: activeTab === 'Settings' ? '#fff' : 'var(--text-muted)', 
                        background: activeTab === 'Settings' ? 'rgba(99,102,241,0.2)' : 'transparent', 
                        border: activeTab === 'Settings' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', 
                        borderRadius: '14px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: effectivelyCollapsed ? '52px' : '100%',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => { if (activeTab !== 'Settings') e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={(e) => { if (activeTab !== 'Settings') e.currentTarget.style.background = 'transparent' }}
                >
                    <span style={{ color: activeTab === 'Settings' ? 'var(--primary, #6366f1)' : 'inherit', display: 'flex' }}>
                        <Settings size={22} /> 
                    </span>
                    {!effectivelyCollapsed && <span>Settings</span>}
                </button>
            </div>
        </aside>
    );
};

export default NexusSidebarComponent;