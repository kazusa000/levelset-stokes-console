export type Dimension = "3d";
export type Algorithm = "v8" | "v9" | "v11" | "v13" | "v14" | "v15";
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
  area_policy: "basic" | "stable";
  accept_policy: "mesh_only" | "objective";
  area_correction_gain: number;
  area_gram_rel_tol: number;
  adapt_size_map: boolean;
  adapt_h_near_factor: number;
  adapt_h_far_factor: number;
  adapt_r_near_factor: number;
  adapt_r_far_factor: number;
  adapt_gradation: number;
  min_thickness: number;
  min_thickness_samples: number;
  min_thickness_active_tol: number;
  min_thickness_inactive_tol: number;
  min_thickness_correction_gain: number;
  min_thickness_dual_tol: number;
  shift_x: number;
  shift_y: number;
  shift_z: number;
  final_refine: boolean;
  final_hmax_factor: number;
  final_hmin_ratio: number;
  final_hausd_ratio: number;
  final_rmc: number;
  smooth_steps: number;
  smooth_eps_factor: number;
  smooth_iso_shift: number;
  feature_smooth_kappa_factor: number;
  feature_smooth_min_weight: number;
  camera_preset: "default" | "front" | "side" | "top" | "isometric";
  fps: number;
  width: number;
  height: number;
  color_by: string;
  show_edges: boolean;
};

export type PostSmoothConfig = {
  mesh_name?: string | null;
  final_hmax_factor: number;
  final_hmin_ratio: number;
  final_hausd_ratio: number;
  final_rmc: number;
  smooth_steps: number;
  smooth_eps_factor: number;
  smooth_iso_shift: number;
  smooth_mode: "global" | "feature";
  feature_smooth_kappa_factor: number;
  feature_smooth_min_weight: number;
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
    duration_seconds?: number | null;
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
  postsmooth_mesh_url?: string | null;
  mesh_options?: MeshOption[];
  postsmooth_config?: PostSmoothConfig | null;
};

export type MeshOption = {
  name: string;
  label: string;
  is_default?: boolean;
  is_smooth?: boolean;
  smooth_name?: string;
  has_smooth?: boolean;
};

export type MeshPolyData = {
  triangle_count: number;
  point_count: number;
  selection_mode?: string;
  points: number[];
  polys: number[];
  bounds?: number[];
};

export type VelocitySampleData = {
  timestep?: number | null;
  count: number;
  min_magnitude: number;
  max_magnitude: number;
  positions: number[];
  vectors: number[];
};

export type FinalMeshData = {
  source: string;
  triangle_count: number;
  point_count: number;
  selection_mode?: string;
  used_reference_filter: boolean;
  points: number[];
  polys: number[];
  obstacle?: MeshPolyData;
  domain?: MeshPolyData;
  velocity?: VelocitySampleData;
};
