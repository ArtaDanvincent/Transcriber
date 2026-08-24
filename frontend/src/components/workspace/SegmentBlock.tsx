"use client";

import { useRef, useEffect } from "react";
import { Segment, Speaker } from "@/types";
import { formatTimestamp } from "@/lib/formatTime";

interface SegmentBlockProps {
  segment: Segment;
  speakers: Speaker[];
  isActive: boolean;
  onUpdate: (id: string, updates: Partial<Segment>) => void;
  onDelete: (id: string) => void;
  onTimestampClick: (time: number) => void;
}

export function SegmentBlock({
  segment,
  speakers,
  isActive,
  onUpdate,
  onDelete,
  onTimestampClick,
}: SegmentBlockProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const speaker = speakers.find((s) => s.id === segment.speaker_id);

  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = "auto";
      textRef.current.style.height = textRef.current.scrollHeight + "px";
    }
  }, [segment.text]);

  return (
    <div
      className={`p-3 rounded border transition-colors ${
        isActive ? "border-blue-300 bg-blue-50" : "border-transparent hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={() => onTimestampClick(segment.start_time)}
          className="text-xs text-blue-600 hover:underline font-mono"
        >
          [{formatTimestamp(segment.start_time)}]
        </button>
        <select
          value={segment.speaker_id || ""}
          onChange={(e) => onUpdate(segment.id, { speaker_id: e.target.value || null })}
          className="text-xs border border-gray-200 rounded px-1.5 py-0.5"
          style={speaker ? { color: speaker.color, fontWeight: 600 } : {}}
        >
          <option value="">No speaker</option>
          {speakers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => onDelete(segment.id)}
          className="ml-auto text-xs text-gray-400 hover:text-red-500"
          title="Delete segment"
        >
          &times;
        </button>
      </div>
      <textarea
        ref={textRef}
        value={segment.text}
        onChange={(e) => onUpdate(segment.id, { text: e.target.value })}
        placeholder="Type transcription here..."
        rows={1}
        className="w-full text-sm text-gray-800 bg-transparent resize-none outline-none overflow-hidden"
      />
    </div>
  );
}
