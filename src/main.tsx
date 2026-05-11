import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { installFlushOnLifecycleEvents } from './services/persistDebounced';
import './styles/index.css';

// Make sure any pending debounced doc write lands before the tab closes or
// becomes hidden. Module-level — runs once at boot.
installFlushOnLifecycleEvents();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found in index.html');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
