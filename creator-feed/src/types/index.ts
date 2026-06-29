export interface YouTubePlatform {
  channelId: string;
  handle?: string;
}

export interface InstagramPlatform {
  username: string;
}

export interface Creator {
  id: string;
  name: string;
  youtube?: YouTubePlatform;
  instagram?: InstagramPlatform;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  channelName: string;
  creatorId: string;
  views?: number;
}

export interface ChannelFeed {
  videos: Video[];
  channelName: string;
}
