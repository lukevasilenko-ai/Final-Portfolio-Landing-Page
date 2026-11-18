import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Set before the first paint so the public site never flashes the admin palette.
document.documentElement.dataset.surface = window.location.pathname.replace(/\/+$/, '') === '/admin' ? 'admin' : 'site';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
