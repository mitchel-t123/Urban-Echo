'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { Youtube, Instagram, ExternalLink } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import VideoGrid from '@/components/VideoGrid';
import InstagramCard from '@/components/InstagramCard';
import { creators } from '@/config/creators';
import { Video } from '@/types';

interface Props {
  params: { id: string };
}

export default function CreatorPage({ params }: Props) {
  const creator = creators.find((c) => c.id === params.id);

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!creator?.youtube) {
      setLoading(false);
      return;
    }

    fetch(`/api/youtube/${creator.youtube.channelId}?creatorId=${creator.id}`)
      .then((r) => r.json())
      .then((data) => setVideos(data.videos ?? []))
      .catch(() => setError('Failed to load videos'))
      .finally(() => setLoading(false));
  }, [creator]);

  if (!creator) return notFound();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-6 md:p-8">
        <div className="mb-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">{creator.name}</h2>
              <div className="flex items-center gap-3 mt-2">
                {creator.youtube && (
                  <a
                    href={`https://youtube.com/${creator.youtube.handle ?? `channel/${creator.youtube.channelId}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <Youtube size={13} />
                    <span>{creator.youtube.handle ?? 'YouTube'}</span>
                    <ExternalLink size={11} />
                  </a>
                )}
                {creator.instagram && (
                  <a
                    href={`https://instagram.com/${creator.instagram.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <Instagram size={13} />
                    <span>@{creator.instagram.username}</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {creator.instagram && (
          <div className="mb-7">
            <p className="text-xs uppercase tracking-widest text-neutral-600 font-medium mb-3">
              Instagram
            </p>
            <div className="max-w-sm">
              <InstagramCard
                username={creator.instagram.username}
                creatorName={creator.name}
              />
            </div>
          </div>
        )}

        {creator.youtube && (
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-600 font-medium mb-4">
              Latest Videos
            </p>
            <VideoGrid videos={videos} loading={loading} error={error} />
          </div>
        )}

        {!creator.youtube && !loading && (
          <div className="flex items-center justify-center h-48 text-neutral-500 text-sm">
            No YouTube channel configured for this creator
          </div>
        )}
      </main>
    </div>
  );
}
