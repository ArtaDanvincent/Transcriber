"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Segment, Speaker } from "@/types";

export function useSegments(jobId: string) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [dirty, setDirty] = useState(false);

  const loadSegments = useCallback(async () => {
    const data = (await api.get(`/api/jobs/${jobId}/segments`)) as Segment[];
    setSegments(data);
    setDirty(false);
  }, [jobId]);

  const loadSpeakers = useCallback(async () => {
    const data = (await api.get(`/api/jobs/${jobId}/speakers`)) as Speaker[];
    setSpeakers(data);
  }, [jobId]);

  const addSegment = (startTime: number) => {
    const maxPos = segments.length > 0 ? Math.max(...segments.map((s) => s.position)) + 1 : 0;
    const newSeg: Segment = {
      id: crypto.randomUUID(),
      job_id: jobId,
      speaker_id: null,
      start_time: startTime,
      end_time: startTime + 5,
      text: "",
      position: maxPos,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSegments((prev) => [...prev, newSeg].sort((a, b) => a.position - b.position));
    setDirty(true);
  };

  const updateSegment = (id: string, updates: Partial<Segment>) => {
    setSegments((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, ...updates } : seg))
    );
    setDirty(true);
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((seg) => seg.id !== id));
    setDirty(true);
  };

  const addSpeaker = async (name: string, color: string) => {
    const label = name.substring(0, 2).toUpperCase();
    const data = (await api.post(`/api/jobs/${jobId}/speakers`, {
      name,
      label,
      color,
    })) as Speaker;
    setSpeakers((prev) => [...prev, data]);
    return data;
  };

  const updateSpeaker = async (id: string, updates: Partial<Speaker>) => {
    const data = (await api.patch(`/api/speakers/${id}`, updates)) as Speaker;
    setSpeakers((prev) => prev.map((s) => (s.id === id ? data : s)));
  };

  const removeSpeaker = async (id: string) => {
    await api.delete(`/api/speakers/${id}`);
    setSpeakers((prev) => prev.filter((s) => s.id !== id));
    setSegments((prev) =>
      prev.map((seg) => (seg.speaker_id === id ? { ...seg, speaker_id: null } : seg))
    );
    setDirty(true);
  };

  return {
    segments,
    setSegments,
    speakers,
    setSpeakers,
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
  };
}
