"use client";

import { useState } from "react";
import { formatTime } from "@/lib/formatTime";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface PlaybackControlsProps {
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  currentTime: number;
  duration: number;
}

export function PlaybackControls({ mediaRef, currentTime, duration }: PlaybackControlsProps) {
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);

  const togglePlay = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  };

  const skip = (seconds: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.currentTime + seconds, el.duration || 0));
  };

  const changeSpeed = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (mediaRef.current) mediaRef.current.playbackRate = newSpeed;
  };

  const changeVolume = (newVolume: number) => {
    setVolume(newVolume);
    if (mediaRef.current) mediaRef.current.volume = newVolume;
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (mediaRef.current) mediaRef.current.currentTime = time;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12 text-right">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={seek}
          className="flex-1 h-1.5 accent-blue-600"
        />
        <span className="text-xs text-gray-500 w-12">{formatTime(duration)}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => skip(-5)} className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded" title="Rewind 5s">
            -5s
          </button>
          <button onClick={togglePlay} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            {mediaRef.current?.paused !== false ? "Play" : "Pause"}
          </button>
          <button onClick={() => skip(5)} className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded" title="Forward 5s">
            +5s
          </button>
        </div>

        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className={`px-1.5 py-0.5 text-xs rounded ${
                speed === s ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => changeVolume(parseFloat(e.target.value))}
            className="w-20 h-1 accent-blue-600"
          />
        </div>
      </div>
    </div>
  );
}
