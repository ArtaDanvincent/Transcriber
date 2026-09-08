export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "completed" | "transcribing" | "failed";
  media_type: "audio" | "video";
  media_duration: number | null;
  media_original_name: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
}

export interface Segment {
  id: string;
  job_id: string;
  speaker_id: string | null;
  start_time: number;
  end_time: number;
  text: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Speaker {
  id: string;
  job_id: string;
  name: string;
  label: string;
  color: string;
  created_at: string;
}

export interface ExportRecord {
  id: string;
  job_id: string;
  format: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
