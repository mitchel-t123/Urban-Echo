import { Instagram, ExternalLink } from 'lucide-react';

interface Props {
  username: string;
  creatorName: string;
}

export default function InstagramCard({ username, creatorName }: Props) {
  return (
    <a
      href={`https://www.instagram.com/${username}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#1e1e1e] transition-colors group"
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
        <Instagram size={16} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">
          @{username}
        </p>
        <p className="text-xs text-neutral-500">{creatorName} on Instagram</p>
      </div>
      <ExternalLink size={14} className="text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0" />
    </a>
  );
}
