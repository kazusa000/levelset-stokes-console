export type Dimension = "2d" | "3d";
export type Algorithm = "original" | "ns" | "rv";
export type ObjectiveMode = "K" | "C" | "Q";
export type ObjectiveSense = "min" | "max";

export type JobConfig = {
  dimension: Dimension;
  algorithm: Algorithm;
  initial_shape: string;
  objective_mode: ObjectiveMode;
  objective_sense: ObjectiveSense;
  mesh_path?: string | null;
  i_axis: number;
  j_axis: number;
  max_iters: number;
  step_k: number;
  hmax: number;
  hmin_ratio: number;
  hausd_ratio: number;
  penalty?: number | null;
  penalty_v?: number | null;
  penalty_nu?: number | null;
  conservative_preset: boolean;
  camera_preset: "default" | "front" | "side" | "top" | "isometric";
  fps: number;
  width: number;
  height: number;
  color_by: string;
  show_edges: boolean;
};

export type SeriesFile = {
  columns: string[];
  rows: Record<string, number>[];
};

export type ExperimentSummary = {
  id: string;
  config: JobConfig;
  meta: Record<string, unknown>;
  summary: {
    iteration?: number | null;
    objective?: number | null;
    stage?: string | null;
    volume?: number | null;
  };
  diagnostics: { title: string; message: string }[];
};

export type ExperimentDetail = ExperimentSummary & {
  series: Record<string, SeriesFile>;
  log_tail: string;
  preview_urls: Record<string, string>;
  final_urls: Record<string, string>;
  xdmf_url?: string | null;
};
