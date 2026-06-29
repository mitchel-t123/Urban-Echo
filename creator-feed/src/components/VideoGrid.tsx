'use client';

import { useState } from 'react';
import VideoCard from './VideoCard';
import VideoModal from './VideoModal';
import { Video } from '@/types';

interface Props {
  videos: Video[];
  loading?: boolean;
  error?: string;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-video rounded-xl bg-[#1e1e1e]" />
      <div className="mt-3 space-y-2">
        <div className="h-3.5 bg-[#1e1e1e] rounded w-full" />
        <div className="h-3.5 bg-[#1e1e1e] rounded w-3/4" />
        <div className="h-3 bg-[#1a1a1a] rounded w-1/2 mt-1" />
      </div>
    </div>
  );
}

export default function VideoGrid({ videos, loading, error }: Props) {
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500 text-sm">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500 text-sm">
        No videos found
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <VideoCard key={`${video.creatorId}-${video.id}`} video={video} onClick={setActiveVideo} />
        ))}
      </div>
      <VideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />
    </>
  );
}
