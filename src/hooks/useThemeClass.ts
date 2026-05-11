import { useDocumentStore } from '@/store';
import { useEffect } from 'react';

export function useThemeClass() {
  const theme = useDocumentStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);
}
