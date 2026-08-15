// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRoot from './AppRoot.jsx';
import './css/variables.css'; // <-- Yeh ab yahan properly imported hai!
import './css/style.css';

// Render the Root App in React
ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);