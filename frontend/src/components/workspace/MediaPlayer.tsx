"use client";

import { useState, useEffect } from "react";
import { PlaybackControls } from "./PlaybackControls";

interface MediaPlayerProps {
  jobId: string;
  mediaType: "audio" | "video";
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  onTimeUpdate: (time: number) => void;
}

export function MediaPlayer({ jobId, mediaType, mediaRef, onTimeUpdate }: MediaPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [, setForceRender] = useState(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const mediaUrl = `${apiUrl}/api/jobs/${jobId}/media${token ? `?token=${token}` : ''}`;

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const handleTimeUpdate = () => {
      const time = el.currentTime;
      setCurrentTime(time);
      onTimeUpdate(time);
    };

    const handleLoaded = () => {
      setDuration(el.duration);
    };

    const handlePlayPause = () => {
      setForceRender((n) => n + 1);
    };

    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("loadedmetadata", handleLoaded);
    el.addEventListener("play", handlePlayPause);
    el.addEventListener("pause", handlePlayPause);

    return () => {
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("loadedmetadata", handleLoaded);
      el.removeEventListener("play", handlePlayPause);
      el.removeEventListener("pause", handlePlayPause);
    };
  }, [mediaRef, onTimeUpdate]);

  return (
    <div className="space-y-3">
      {mediaType === "video" ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={mediaUrl}
          className="w-full rounded bg-black"
          crossOrigin="use-credentials"
        >
          <source src={mediaUrl} />
        </video>
      ) : (
        <div className="bg-gray-900 rounded p-8 flex items-center justify-center">
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={mediaUrl}
          />
          <span className="text-4xl">&#x1F3A7;</span>
        </div>
      )}
      <PlaybackControls
        mediaRef={mediaRef}
        currentTime={currentTime}
        duration={duration}
      />
    </div>
  );
}
