"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Job, JobListResponse } from "@/types";

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api.get("/api/jobs")) as JobListResponse;
      setJobs(data.jobs);
      setTotal(data.total);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteJob = async (id: string) => {
    await api.delete(`/api/jobs/${id}`);
    await refresh();
  };

  return { jobs, total, loading, refresh, deleteJob };
}
