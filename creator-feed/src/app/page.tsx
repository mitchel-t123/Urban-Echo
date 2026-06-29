'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import VideoGrid from '@/components/VideoGrid';
import { creators } from '@/config/creators';
import { Video } from '@/types';

export default function HomePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const youtubeCreators = creators.filter((c) => c.youtube);

    Promise.all(
      youtubeCreators.map((creator) =>
        fetch(`/api/youtube/${creator.youtube!.channelId}?creatorId=${creator.id}`)
          .then((r) => r.json())
          .then((data) =>
            (data.videos as Video[]).map((v) => ({ ...v, creatorId: creator.id }))
          )
          .catch(() => [] as Video[])
      )
    )
      .then((results) => {
        const all = results.flat().sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        setVideos(all);
      })
      .catch(() => setError('Failed to load videos'))
      .finally(() => setLoading(false));
  }, []);

  const youtubeCount = creators.filter((c) => c.youtube).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-6 md:p-8">
        <div className="mb-7">
          <h2 className="text-xl font-semibold text-white">Latest Videos</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Latest from {youtubeCount} creator{youtubeCount !== 1 ? 's' : ''} · sorted by date
          </p>
        </div>
        <VideoGrid videos={videos} loading={loading} error={error} />
      </main>
    </div>
  );
}
