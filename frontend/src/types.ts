export type Dimension = "3d";
export type Algorithm = "v1" | "v2" | "v3" | "v4_test";
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
  convergence_window: number;
  convergence_rtol_jraw: number;
  ns_alpha_j: number;
  ns_alpha_c: number;
  surface_area_factor: number;
  final_refine: boolean;
  final_hmax_factor: number;
  final_hmin_ratio: number;
  final_hausd_ratio: number;
  final_rmc: number;
  smooth_steps: number;
  smooth_eps_factor: number;
  smooth_iso_shift: number;
  penalty?: number | null;
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
  final_mesh_url?: string | null;
};

export type FinalMeshData = {
  source: string;
  triangle_count: number;
  point_count: number;
  selection_mode?: string;
  used_reference_filter: boolean;
  points: number[];
  polys: number[];
};
