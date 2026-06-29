'use client';

import Image from 'next/image';
import { Video } from '@/types';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K views`;
  return `${views} views`;
}

interface Props {
  video: Video;
  onClick: (video: Video) => void;
}

export default function VideoCard({ video, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(video)}
      className="group text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
    >
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1a1a1a]">
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg">
            <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <p className="text-sm font-medium text-neutral-100 line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {video.title}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-500">
          <span>{video.channelName}</span>
          {video.views ? (
            <>
              <span>·</span>
              <span>{formatViews(video.views)}</span>
            </>
          ) : null}
          <span>·</span>
          <span>{timeAgo(video.publishedAt)}</span>
        </div>
      </div>
    </button>
  );
}
