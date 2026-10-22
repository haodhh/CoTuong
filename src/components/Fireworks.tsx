import { useEffect, useRef } from 'react';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds left; the spark fades out over its last second. */
  life: number;
  hue: number;
  /** A rocket climbs and bursts into sparks when it slows down. */
  rocket: boolean;
}

/** Each spark is drawn as a streak covering this many seconds of its path. */
const STREAK = 0.05;

const GRAVITY = 260;
const SPARKS = 64;

/**
 * A few seconds of fireworks over the whole page. It ignores taps (the board stays playable) and
 * shows nothing when the player asked the system for reduced motion.
 */
export function Fireworks({ seconds = 3.5, onDone }: { seconds?: number; onDone?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      done.current?.();
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const sparks: Spark[] = [];
    const launch = () => {
      const x = w * (0.15 + Math.random() * 0.7);
      // Fast enough to reach the upper third of the screen.
      const vy = -Math.sqrt(2 * GRAVITY * h * (0.45 + Math.random() * 0.3));
      sparks.push({ x, y: h, vx: (Math.random() - 0.5) * 60, vy, life: 3, hue: Math.random() * 360, rocket: true });
    };
    const burst = (r: Spark) => {
      // Bigger bursts on bigger screens.
      const speed = (90 + Math.random() * 90) * Math.min(1.8, Math.max(1, Math.min(w, h) / 450));
      for (let i = 0; i < SPARKS; i++) {
        const a = (i / SPARKS) * Math.PI * 2 + Math.random() * 0.2;
        const v = speed * (0.6 + Math.random() * 0.4);
        sparks.push({
          x: r.x,
          y: r.y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 1.1 + Math.random() * 0.6,
          hue: r.hue + (Math.random() - 0.5) * 40,
          rocket: false,
        });
      }
    };

    // Rockets go up in a quick salvo, then a few more until the end.
    const launches = [0, 0.15, 0.35, 0.6, 0.9, 1.2, 1.5, 1.85, 2.2].filter((t) => t < seconds - 1.2);
    let next = 0;
    let start = 0;
    let last = 0;
    let frame = 0;
    const step = (now: number) => {
      if (!start) start = last = now;
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      while (next < launches.length && launches[next] <= t) {
        launch();
        if (next % 3 === 0) launch();
        next++;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vy += GRAVITY * dt * (s.rocket ? 1 : 0.35);
        if (!s.rocket) {
          s.vx *= 1 - 1.2 * dt;
          s.vy *= 1 - 1.2 * dt;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
        if (s.rocket && s.vy >= -40) {
          burst(s);
          sparks.splice(i, 1);
          continue;
        }
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        const alpha = Math.min(1, s.life);
        ctx.strokeStyle = `hsla(${s.hue}, 100%, ${s.rocket ? 80 : 62}%, ${alpha})`;
        ctx.lineWidth = s.rocket ? 2.5 : 2;
        ctx.beginPath();
        ctx.moveTo(s.x - s.vx * STREAK, s.y - s.vy * STREAK);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (next >= launches.length && sparks.length === 0) {
        done.current?.();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [seconds]);

  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-50 h-full w-full" aria-hidden="true" />;
}
