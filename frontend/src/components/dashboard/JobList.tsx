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
    return <div className="text-center text-gray-500 py-12">Loading...</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        <p className="text-lg mb-2">No transcriptions yet</p>
        <p className="text-sm">Upload a recording to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onDelete={onDelete} />
      ))}
    </div>
  );
}
