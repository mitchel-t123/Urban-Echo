import Sidebar from '@/components/Sidebar';
import VideoGrid from '@/components/VideoGrid';
import { creators } from '@/config/creators';
import { fetchChannelVideos } from '@/lib/youtube';

export default async function HomePage() {
  const results = await Promise.all(
    creators
      .filter((c) => c.youtube)
      .map((c) => fetchChannelVideos(c.youtube!.channelId, c.id))
  );

  const videos = results
    .flat()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

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
        <VideoGrid videos={videos} />
      </main>
    </div>
  );
}
