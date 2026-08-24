"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Navbar } from "@/components/layout/Navbar";
import { JobList } from "@/components/dashboard/JobList";
import { UploadModal } from "@/components/dashboard/UploadModal";
import { useJobs } from "@/hooks/useJobs";

export default function DashboardPage() {
  const { jobs, loading, refresh, deleteJob } = useJobs();
  const [showUpload, setShowUpload] = useState(false);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">My Transcriptions</h2>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              + Upload
            </button>
          </div>
          <JobList jobs={jobs} loading={loading} onDelete={deleteJob} />
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
