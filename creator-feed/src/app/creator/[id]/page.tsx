import { notFound } from 'next/navigation';
import { Youtube, Instagram, ExternalLink } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import VideoGrid from '@/components/VideoGrid';
import InstagramCard from '@/components/InstagramCard';
import { creators } from '@/config/creators';
import { fetchChannelVideos } from '@/lib/youtube';

export function generateStaticParams() {
  return creators.map((c) => ({ id: c.id }));
}

interface Props {
  params: { id: string };
}

export default async function CreatorPage({ params }: Props) {
  const creator = creators.find((c) => c.id === params.id);
  if (!creator) notFound();

  const videos = creator.youtube
    ? await fetchChannelVideos(creator.youtube.channelId, creator.id)
    : [];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-6 md:p-8">
        <div className="mb-7">
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
            <VideoGrid videos={videos} />
          </div>
        )}
      </main>
    </div>
  );
}
