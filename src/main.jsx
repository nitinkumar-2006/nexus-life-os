// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRoot from './AppRoot.jsx';
import { installAutoCapitalize } from './utils/autoCapitalize.js';
import './css/variables.css'; // <-- Yeh ab yahan properly imported hai!
import './css/style.css';
import './css/aiChat.css';
import './css/settingsLayout.css';
import './css/editProfileModal.css';
import './css/profilePage.css';
import './css/calendarHub.css';
import './css/financeHub.css';
import './css/weatherHub.css';
import './css/notifications.css';
import './css/masterSchedule.css';
import './css/audioPlayer.css';
import './css/cameraCapture.css';
import './css/audioHubOverlays.css';

installAutoCapitalize();

// Render the Root App in React
ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);