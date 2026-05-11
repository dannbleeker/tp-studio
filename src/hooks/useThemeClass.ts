import { useEffect } from 'react';
import { useDocumentStore } from '../store';

export function useThemeClass() {
  const theme = useDocumentStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);
}
