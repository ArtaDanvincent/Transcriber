"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { MediaPlayer } from "@/components/workspace/MediaPlayer";
import { TranscriptEditor } from "@/components/workspace/TranscriptEditor";
import { SpeakerPanel } from "@/components/workspace/SpeakerPanel";
import { ExportMenu } from "@/components/workspace/ExportMenu";
import { useSegments } from "@/hooks/useSegments";
import { useAutoSave } from "@/hooks/useAutoSave";
import { api } from "@/lib/api";
import { Job } from "@/types";

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const mediaRef = useRef<HTMLMediaElement>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [title, setTitle] = useState("");

  const {
    segments,
    speakers,
    loadSegments,
    loadSpeakers,
    addSegment,
    updateSegment,
    removeSegment,
    addSpeaker,
    updateSpeaker,
    removeSpeaker,
    dirty,
    setDirty,
  } = useSegments(jobId);

  const { lastSaved, saving, forceSave } = useAutoSave(jobId, segments, dirty, setDirty);

  useEffect(() => {
    const loadJob = async () => {
      try {
        const data = (await api.get(`/api/jobs/${jobId}`)) as Job;
        setJob(data);
        setTitle(data.title);
      } catch {
        router.push("/dashboard");
      }
    };
    loadJob();
    loadSegments();
    loadSpeakers();
  }, [jobId, loadSegments, loadSpeakers, router]);

  const handleTitleBlur = async () => {
    if (job && title !== job.title) {
      await api.patch(`/api/jobs/${jobId}`, { title });
    }
  };

  const handleTimestampClick = useCallback((time: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
    }
  }, []);

  const wordCount = segments.reduce((sum, seg) => {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    return sum + words.length;
  }, 0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.code) {
          case "Space":
            e.preventDefault();
            if (mediaRef.current) {
              if (mediaRef.current.paused) mediaRef.current.play();
              else mediaRef.current.pause();
            }
            break;
          case "ArrowLeft":
            e.preventDefault();
            if (mediaRef.current) {
              mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 5);
            }
            break;
          case "ArrowRight":
            e.preventDefault();
            if (mediaRef.current) {
              mediaRef.current.currentTime = Math.min(
                mediaRef.current.duration || 0,
                mediaRef.current.currentTime + 5
              );
            }
            break;
          case "ArrowUp":
            e.preventDefault();
            if (mediaRef.current) {
              const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
              const idx = speeds.indexOf(mediaRef.current.playbackRate);
              if (idx < speeds.length - 1) {
                mediaRef.current.playbackRate = speeds[idx + 1];
              }
            }
            break;
          case "ArrowDown":
            e.preventDefault();
            if (mediaRef.current) {
              const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
              const idx = speeds.indexOf(mediaRef.current.playbackRate);
              if (idx > 0) {
                mediaRef.current.playbackRate = speeds[idx - 1];
              }
            }
            break;
          case "Enter":
            e.preventDefault();
            addSegment(currentTime);
            break;
          case "KeyS":
            e.preventDefault();
            forceSave();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, addSegment, forceSave]);

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Back
            </button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="text-lg font-semibold text-gray-900 outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500"
            />
          </div>
          <ExportMenu jobId={jobId} />
        </div>

        {/* Main workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: Media + Speakers */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col">
            <div className="p-4 flex-shrink-0">
              <MediaPlayer
                jobId={jobId}
                mediaType={job.media_type}
                mediaRef={mediaRef}
                onTimeUpdate={setCurrentTime}
              />
            </div>
            <div className="p-4 border-t border-gray-200">
              <SpeakerPanel
                speakers={speakers}
                onAdd={addSpeaker}
                onUpdate={updateSpeaker}
                onDelete={removeSpeaker}
              />
            </div>
          </div>

          {/* Right panel: Transcript */}
          <div className="w-1/2 flex flex-col">
            <TranscriptEditor
              segments={segments}
              speakers={speakers}
              currentTime={currentTime}
              onUpdateSegment={updateSegment}
              onDeleteSegment={removeSegment}
              onAddSegment={addSegment}
              onTimestampClick={handleTimestampClick}
              wordCount={wordCount}
              lastSaved={lastSaved}
              saving={saving}
            />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
