import { useEffect } from 'react';

// Phone keyboards shrink only the visual viewport, not 100dvh. Publish its height as --app-h
// (the shells use it, falling back to 100dvh) and keep the focused field in view.
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;

    const update = () => {
      root.style.setProperty('--app-h', `${vv.height}px`);
      if (vv.offsetTop > 0) window.scrollTo(0, 0);
      const el = document.activeElement;
      if (el instanceof HTMLInputElement) el.scrollIntoView({ block: 'center' });
    };

    update();
    vv.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      root.style.removeProperty('--app-h');
    };
  }, []);
}
