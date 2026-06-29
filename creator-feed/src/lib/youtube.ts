import { XMLParser } from 'fast-xml-parser';
import { Video } from '@/types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'entry',
});

export async function fetchChannelVideos(channelId: string, creatorId: string): Promise<Video[]> {
  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  );

  if (!res.ok) return [];

  const xml = await res.text();
  const feed = parser.parse(xml);
  const entries: any[] = feed.feed?.entry ?? [];
  const channelName: string = feed.feed?.author?.name ?? 'Unknown';

  return entries.slice(0, 12).map((entry) => {
    const videoId = entry['yt:videoId'] ?? '';
    return {
      id: videoId,
      title: entry.title ?? '',
      description: entry['media:group']?.['media:description'] ?? '',
      publishedAt: entry.published ?? '',
      thumbnail:
        entry['media:group']?.['media:thumbnail']?.['@_url'] ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      channelName,
      creatorId,
      views: Number(
        entry['media:group']?.['media:community']?.['media:statistics']?.['@_views'] ?? 0
      ),
    };
  });
}
