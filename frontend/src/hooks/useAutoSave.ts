"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { Segment } from "@/types";

export function useAutoSave(
  jobId: string,
  segments: Segment[],
  dirty: boolean,
  setDirty: (d: boolean) => void
) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const payload = segments.map((seg) => ({
        id: seg.id,
        speaker_id: seg.speaker_id,
        start_time: seg.start_time,
        end_time: seg.end_time,
        text: seg.text,
        position: seg.position,
      }));
      const saved = (await api.put(`/api/jobs/${jobId}/segments`, {
        segments: payload,
      })) as Segment[];
      setDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      console.error("Autosave failed:", err);
    } finally {
      setSaving(false);
    }
  }, [jobId, segments, dirty, saving, setDirty]);

  useEffect(() => {
    if (!dirty) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(save, 5000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [dirty, segments, save]);

  const forceSave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    save();
  };

  return { lastSaved, saving, forceSave };
}
