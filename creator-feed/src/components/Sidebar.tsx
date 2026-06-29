'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Youtube, Instagram, LayoutGrid, ChevronRight } from 'lucide-react';
import { creators } from '@/config/creators';

function CreatorAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const colors = [
    'bg-violet-600', 'bg-blue-600', 'bg-emerald-600',
    'bg-rose-600', 'bg-amber-600', 'bg-cyan-600',
  ];
  const color = colors[name.charCodeAt(0) % colors.length];

  return (
    <div
      className={`${color} w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}
    >
      {initials}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-[#141414] border-r border-[#2a2a2a] flex flex-col z-40">
      <div className="px-5 py-5 border-b border-[#2a2a2a]">
        <h1 className="text-base font-semibold text-white tracking-tight">Creator Feed</h1>
        <p className="text-xs text-neutral-500 mt-0.5">Ad-free · Curated</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <Link
          href="/"
          className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
            pathname === '/'
              ? 'bg-[#1e1e1e] text-white'
              : 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          <LayoutGrid size={16} />
          <span>All Content</span>
          {pathname === '/' && <ChevronRight size={14} className="ml-auto opacity-40" />}
        </Link>

        <div className="px-4 pt-5 pb-2">
          <p className="text-[10px] uppercase tracking-widest text-neutral-600 font-medium">
            Creators
          </p>
        </div>

        {creators.map((creator) => (
          <Link
            key={creator.id}
            href={`/creator/${creator.id}`}
            className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors group ${
              pathname === `/creator/${creator.id}`
                ? 'bg-[#1e1e1e] text-white'
                : 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <CreatorAvatar name={creator.name} />
            <span className="truncate">{creator.name}</span>

            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {creator.youtube && (
                <Youtube size={12} className="text-neutral-500" />
              )}
              {creator.instagram && (
                <Instagram size={12} className="text-neutral-500" />
              )}
            </div>
          </Link>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-[#2a2a2a]">
        <p className="text-[10px] text-neutral-600 leading-relaxed">
          Edit <code className="text-neutral-500">src/config/creators.ts</code> to add or remove creators.
        </p>
      </div>
    </aside>
  );
}
