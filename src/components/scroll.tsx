import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation, useNavigationType, type LinkProps } from 'react-router';

/** Scroll position of each history entry, for the browser's Back and Forward. */
const byEntry = new Map<string, number>();
/** Last address (query) and scroll position of each page, for the "← Tất cả …" links. */
const byPage = new Map<string, { search: string; y: number }>();

/**
 * Scrolls to `y` as soon as the page is tall enough: lists render once their data has loaded.
 * Gives up after two seconds or when the player scrolls or taps first.
 */
function scrollWhenReady(y: number): () => void {
  const until = Date.now() + 2000;
  let frame = 0;
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  const stop = () => {
    cancelAnimationFrame(frame);
    for (const e of events) window.removeEventListener(e, stop);
  };
  const step = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max >= y || Date.now() > until) {
      window.scrollTo(0, Math.min(y, Math.max(0, max)));
      stop();
    } else frame = requestAnimationFrame(step);
  };
  for (const e of events) window.addEventListener(e, stop, { passive: true });
  step();
  return stop;
}

/**
 * Back and Forward return to where the page was scrolled; a link to another page starts at its
 * top; a change of filters (same page) keeps the position.
 */
export function useScrollRestoration() {
  const location = useLocation();
  const type = useNavigationType();
  const current = useRef(location);
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const onScroll = () => {
      const { key, pathname, search } = current.current;
      byEntry.set(key, window.scrollY);
      byPage.set(pathname, { search, y: window.scrollY });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    // Updated before the browser reports the scroll caused by the new page, which belongs to it.
    current.current = location;
    const samePage = previousPath.current === location.pathname;
    previousPath.current = location.pathname;
    const y = type === 'POP' ? byEntry.get(location.key) : (location.state as { scrollY?: number } | null)?.scrollY;
    byPage.set(location.pathname, { search: location.search, y: y ?? (samePage ? window.scrollY : 0) });
    if (y !== undefined) return scrollWhenReady(y);
    if (!samePage) window.scrollTo(0, 0);
  }, [location.key]);
}

/** A link back to a list page, with the filters and the scroll position it was left with. */
export function BackLink({ to, ...props }: Omit<LinkProps, 'to' | 'state'> & { to: string }) {
  const last = byPage.get(to);
  return <Link to={last ? to + last.search : to} state={last ? { scrollY: last.y } : undefined} {...props} />;
}
