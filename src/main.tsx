// Setup React environment and core dependencies
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './assets/css/index.css';
import Login from "./connection/loginConnection";
import { Dashboard } from './screens/Dashboard';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Initialize root DOM element and React root
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = createRoot(rootElement);

// Render application with routing and strict mode
root.render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login role="default" />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
