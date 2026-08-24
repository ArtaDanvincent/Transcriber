"use client";

import { useRouter } from "next/navigation";
import { Job } from "@/types";
import { formatTime, formatTimeAgo } from "@/lib/formatTime";

interface JobCardProps {
  job: Job;
  onDelete: (id: string) => void;
}

export function JobCard({ job, onDelete }: JobCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/workspace/${job.id}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this transcription?")) {
      onDelete(job.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group relative glass rounded-xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/5 glow-border animate-float-in"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            job.media_type === "video"
              ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400"
              : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400"
          }`}>
            {job.media_type === "video" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect width="15" height="14" x="1" y="5" rx="2" ry="2" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors">{job.title}</h3>
            <div className="flex items-center gap-3 mt-1">
              {job.media_duration != null && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {formatTime(job.media_duration)}
                </span>
              )}
              <span className="text-xs text-slate-500">{formatTimeAgo(job.updated_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${
            job.status === "completed"
              ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
              : "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
          }`}>
            {job.status === "completed" ? "Done" : "Draft"}
          </span>
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10"
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}
