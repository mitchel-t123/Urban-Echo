import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import { Video } from '@/types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'entry',
});

export async function GET(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  const { channelId } = params;
  const creatorId = request.nextUrl.searchParams.get('creatorId') || '';

  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    { next: { revalidate: 1800 } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch channel feed' }, { status: 502 });
  }

  const xml = await res.text();
  const feed = parser.parse(xml);

  const entries: any[] = feed.feed?.entry ?? [];
  const channelName: string = feed.feed?.author?.name ?? 'Unknown';

  const videos: Video[] = entries.slice(0, 12).map((entry) => {
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

  return NextResponse.json({ videos, channelName });
}
