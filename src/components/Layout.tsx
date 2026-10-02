import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useDueCount } from '../data/store';

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

const NAV: { title?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', icon: '🏠', label: 'Trang chủ' }] },
  {
    title: 'Chơi',
    items: [
      { to: '/play', icon: '🤖', label: 'Chơi với máy' },
      { to: '/local', icon: '👥', label: 'Hai người' },
      { to: '/games', icon: '📜', label: 'Ván đã chơi' },
      { to: '/analysis', icon: '🔍', label: 'Phân tích' },
    ],
  },
  {
    title: 'Puzzle',
    items: [
      { to: '/puzzles', icon: '🧩', label: 'Puzzle' },
      { to: '/themes', icon: '🎯', label: 'Chủ đề' },
      { to: '/rush', icon: '⚡', label: 'Rush' },
      { to: '/review', icon: '🔁', label: 'Ôn lỗi' },
      { to: '/daily', icon: '📅', label: 'Hằng ngày' },
    ],
  },
  {
    title: 'Luyện tập',
    items: [
      { to: '/endgames', icon: '🏁', label: 'Tàn cuộc' },
      { to: '/learn', icon: '🎓', label: 'Học luật' },
    ],
  },
  {
    items: [
      { to: '/stats', icon: '📈', label: 'Thống kê' },
      { to: '/settings', icon: '⚙️', label: 'Cài đặt' },
    ],
  },
];

/** Re-renders every minute so time-based counts (due reviews) stay fresh. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Layout() {
  const due = useDueCount(useNow()) ?? 0;
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      isActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5 hover:text-white'
    }`;

  const link = (item: NavItem) => (
    <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
      <span className="text-lg leading-none">{item.icon}</span>
      <span>{item.label}</span>
      {item.to === '/review' && due > 0 && <span className="ml-auto rounded-full bg-bad px-1.5 text-xs text-white">{due}</span>}
    </NavLink>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-52 shrink-0 flex-col gap-0.5 border-r border-white/5 bg-[#1b1916] p-3 lg:flex">
        <Brand />
        {NAV.map((group, i) => (
          <div key={i} className="mb-2 flex flex-col gap-0.5">
            {group.title && <div className="px-3 pt-1 pb-0.5 text-[11px] font-bold tracking-wider text-muted uppercase">{group.title}</div>}
            {group.items.map(link)}
          </div>
        ))}
      </aside>
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#1b1916] lg:hidden">
        <div className="px-4 pt-3">
          <Brand />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">{NAV.flatMap((g) => g.items).map(link)}</nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  );
}

function Brand() {
  return (
    <NavLink to="/" className="mb-3 flex items-center gap-2 px-2 text-xl font-extrabold">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent bg-[#f3dfb6] font-serif text-lg text-[#c0161c]">
        帥
      </span>
      <span>
        Cờ Tướng <span className="text-accent">Luyện Tập</span>
      </span>
    </NavLink>
  );
}
