"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Navbar } from "@/components/layout/Navbar";
import { AnimatedBackground } from "@/components/layout/AnimatedBackground";
import { JobList } from "@/components/dashboard/JobList";
import { UploadModal } from "@/components/dashboard/UploadModal";
import { useJobs } from "@/hooks/useJobs";

export default function DashboardPage() {
  const { jobs, loading, refresh, deleteJob } = useJobs();
  const [showUpload, setShowUpload] = useState(false);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#0a0b14]">
        <AnimatedBackground />

        <div className="relative z-10">
          <Navbar />

          <div className="max-w-3xl mx-auto px-4 py-10">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">My Transcriptions</h2>
                <p className="text-sm text-slate-500">
                  {jobs.length > 0 ? `${jobs.length} recording${jobs.length !== 1 ? "s" : ""}` : "Upload your first recording"}
                </p>
              </div>
              <button
                onClick={() => setShowUpload(true)}
                className="group flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-105 active:scale-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover:rotate-90 transition-transform duration-300">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Upload
              </button>
            </div>

            <JobList jobs={jobs} loading={loading} onDelete={deleteJob} />
          </div>
        </div>

        <UploadModal
          open={showUpload}
          onClose={() => setShowUpload(false)}
          onUploaded={refresh}
        />
      </div>
    </AuthGuard>
  );
}
