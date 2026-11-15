// ExMonitor sensor-page entry point.
// Built with AI assistance: most of this codebase was written in a
// pair-programming loop with an AI coding agent and reviewed by the author.
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import { SensorPage } from './SensorPage';
import '../index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SensorPage />
  </React.StrictMode>
);
