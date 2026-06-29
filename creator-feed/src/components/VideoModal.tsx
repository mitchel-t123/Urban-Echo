'use client';

import { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Video } from '@/types';

interface Props {
  video: Video | null;
  onClose: () => void;
}

export default function VideoModal({ video, onClose }: Props) {
  useEffect(() => {
    if (!video) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [video, onClose]);

  useEffect(() => {
    if (video) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [video]);

  if (!video) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-4xl bg-[#141414] rounded-2xl overflow-hidden shadow-2xl border border-[#2a2a2a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&color=white`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-white leading-snug">{video.title}</h2>
              <p className="text-sm text-neutral-500 mt-1">{video.channelName}</p>
              {video.description && (
                <p className="text-xs text-neutral-600 mt-3 line-clamp-3 leading-relaxed">
                  {video.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={`https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-xs text-neutral-400 hover:text-white transition-colors"
                title="Open on YouTube"
              >
                <ExternalLink size={13} />
                <span>YouTube</span>
              </a>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-neutral-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
