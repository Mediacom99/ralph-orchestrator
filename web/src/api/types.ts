export type LoopStatus =
  | "cloning"
  | "running"
  | "stopped"
  | "complete"
  | "failed"
  | "error";

export interface RalphStatusData {
  loop_count: number;
  calls_made: number;
  max_calls_per_hour: number;
  status: string;
  exit_reason?: string;
}

export interface ProgressData {
  tasks_total: number;
  tasks_done: number;
  percentage: number;
  elapsed_seconds: number;
  last_output?: string;
}

export interface SettingsResponse {
  github_token: string;
  has_github_token: boolean;
}

export interface Loop {
  id: string;
  git_url: string;
  repo_name: string;
  local_path: string;
  status: LoopStatus;
  pid?: number;
  created_at: string;
  started_at?: string;
  stopped_at?: string;
  ralph_status?: RalphStatusData;
  progress?: ProgressData;
}
