import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Protect against benign WebSocket / Vite HMR connection drops in AI Studio iframe
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event && (event.reason ? event.reason.message || String(event.reason) : '');
    if (reason && (reason.includes('WebSocket') || reason.includes('vite') || reason.includes('ws:'))) {
      event.preventDefault();
    }
  });
}

// Register service worker for iOS PWA caching
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration note:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
