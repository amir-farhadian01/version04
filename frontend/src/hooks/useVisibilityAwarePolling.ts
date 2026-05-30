import { useEffect, useState } from 'react';

/**
 * Returns whether the browser tab is currently visible.
 * When hidden, polling should be paused to save resources.
 *
 * Usage:
 *   const isVisible = useTabVisibility();
 *   // In useEffect with setInterval:
 *   //   if (!isVisible) clearInterval(id);
 *   //   else setInterval(fn, ms);
 */
export function useTabVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(
    typeof document !== 'undefined' ? !document.hidden : true,
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}