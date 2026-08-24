"use client";

import { useRef, useEffect } from "react";
import { Segment, Speaker } from "@/types";
import { SegmentBlock } from "./SegmentBlock";

interface TranscriptEditorProps {
  segments: Segment[];
  speakers: Speaker[];
  currentTime: number;
  onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
  onDeleteSegment: (id: string) => void;
  onAddSegment: (time: number) => void;
  onTimestampClick: (time: number) => void;
  wordCount: number;
  lastSaved: Date | null;
  saving: boolean;
}

export function TranscriptEditor({
  segments,
  speakers,
  currentTime,
  onUpdateSegment,
  onDeleteSegment,
  onAddSegment,
  onTimestampClick,
  wordCount,
  lastSaved,
  saving,
}: TranscriptEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const activeIndex = segments.findIndex(
    (seg) => currentTime >= seg.start_time && currentTime < seg.end_time
  );

  useEffect(() => {
    if (activeIndex >= 0 && containerRef.current) {
      const activeEl = containerRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeIndex]);

  const formatLastSaved = () => {
    if (saving) return "Saving...";
    if (!lastSaved) return "";
    const diff = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (diff < 5) return "Saved just now";
    if (diff < 60) return `Saved ${diff}s ago`;
    return `Saved ${Math.floor(diff / 60)}m ago`;
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-1 p-2">
        {segments.map((seg, i) => (
          <SegmentBlock
            key={seg.id}
            segment={seg}
            speakers={speakers}
            isActive={i === activeIndex}
            onUpdate={onUpdateSegment}
            onDelete={onDeleteSegment}
            onTimestampClick={onTimestampClick}
          />
        ))}
      </div>
      <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => onAddSegment(currentTime)}
          className="text-sm text-blue-600 hover:underline"
        >
          + Add Segment
        </button>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{wordCount} words</span>
          <span>{formatLastSaved()}</span>
        </div>
      </div>
    </div>
  );
}
