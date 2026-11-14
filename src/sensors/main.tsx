import React from 'react';
import ReactDOM from 'react-dom/client';
import { SensorPage } from './SensorPage';
import '../index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SensorPage />
  </React.StrictMode>
);
