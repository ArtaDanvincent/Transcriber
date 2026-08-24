"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ExportRecord } from "@/types";

interface ExportMenuProps {
  jobId: string;
}

const FORMATS = [
  { value: "txt", label: "Plain Text (.txt)" },
  { value: "srt", label: "Subtitles (.srt)" },
  { value: "vtt", label: "Web Subtitles (.vtt)" },
];

export function ExportMenu({ jobId }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: string) => {
    setExporting(true);
    try {
      const exportData = (await api.post(`/api/jobs/${jobId}/export`, { format })) as ExportRecord;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${apiUrl}/api/exports/${exportData.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcript.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={exporting}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
      >
        {exporting ? "Exporting..." : "Export"}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg z-10">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleExport(f.value)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
