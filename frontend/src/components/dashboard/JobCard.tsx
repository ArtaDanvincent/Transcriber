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
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{job.media_type === "video" ? "🎥" : "🎧"}</span>
          <h3 className="font-medium text-gray-900">{job.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              job.status === "completed"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {job.status === "completed" ? "Completed" : "Draft"}
          </span>
          <button
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-500 text-sm"
            title="Delete"
          >
            &times;
          </button>
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-500 flex items-center gap-3">
        {job.media_duration && <span>{formatTime(job.media_duration)}</span>}
        <span>{formatTimeAgo(job.updated_at)}</span>
      </div>
    </div>
  );
}
