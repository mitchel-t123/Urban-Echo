'use client';

import { useState } from 'react';
import VideoCard from './VideoCard';
import VideoModal from './VideoModal';
import { Video } from '@/types';

interface Props {
  videos: Video[];
}

export default function VideoGrid({ videos }: Props) {
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);

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
