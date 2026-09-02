// src/components/SidebarToggleIcon.jsx
//
// The one, shared "toggle a sidebar" icon used everywhere this app has a
// collapsible side panel - the main desktop sidebar (now toggled from
// the header, see header.jsx), the AI section's own sidebar rail/toggle
// (AISidebar.jsx), its main-area menu button (AIChatArea.jsx), and the
// Voice Assistant view's equivalent (AIVoiceAssistantView.jsx). Before
// this, each of those five spots hand-rendered its own plain lucide
// Menu icon - functionally fine, but visually generic next to a real,
// explicit comparison against a more polished reference (Gemini's own
// sidebar toggle): a neutral two-panel rectangle at rest that reveals a
// small directional arrow INSIDE it on hover, rather than changing
// icons or shapes entirely. A single shared component (not five
// separately hand-copied hover implementations) is what keeps all five
// spots genuinely identical instead of slowly drifting apart.
//
// Pure CSS hover-swap (see .nexus-sidebar-toggle-icon rules in
// style.css) - no per-instance React hover state needed, since a plain
// CSS :hover selector on the ancestor button already does this, and
// works identically regardless of which of the five different button
// elements this ends up inside.
import { PanelLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

// isOpen: whether the sidebar THIS button controls is currently open/
// expanded - determines which arrow direction appears on hover (closing
// vs opening), matching the real action a click performs.
const SidebarToggleIcon = ({ isOpen, size = 18 }) => (
    <span className="nexus-sidebar-toggle-icon" style={{ width: size, height: size }}>
        <PanelLeft size={size} className="nexus-sidebar-toggle-icon-base" />
        {isOpen
            ? <PanelLeftClose size={size} className="nexus-sidebar-toggle-icon-hover" />
            : <PanelLeftOpen size={size} className="nexus-sidebar-toggle-icon-hover" />}
    </span>
);

export default SidebarToggleIcon;
