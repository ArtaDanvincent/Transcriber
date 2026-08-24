"use client";

import { Job } from "@/types";
import { JobCard } from "./JobCard";

interface JobListProps {
  jobs: Job[];
  loading: boolean;
  onDelete: (id: string) => void;
}

export function JobList({ jobs, loading, onDelete }: JobListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-xl p-5 animate-shimmer" style={{ animationDelay: `${i * 0.15}s` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/5" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-1/3 rounded bg-white/5" />
                <div className="h-3 w-1/5 rounded bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center mb-6 ring-1 ring-white/5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-slate-300 mb-1">No transcriptions yet</p>
        <p className="text-sm text-slate-500">Upload a recording to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job, i) => (
        <div key={job.id} style={{ animationDelay: `${i * 0.08}s` }}>
          <JobCard job={job} onDelete={onDelete} />
        </div>
      ))}
    </div>
  );
}
