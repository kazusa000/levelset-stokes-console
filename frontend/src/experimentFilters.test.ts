import { filterExperimentSummaries } from "./experimentFilters";
import type { ExperimentSummary, JobConfig } from "./types";

function assertDeepEqual(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const baseConfig: JobConfig = {
  dimension: "3d",
  algorithm: "v13",
  initial_shape: "sphere",
  objective_mode: "K",
  objective_sense: "min",
  i_axis: 1,
  j_axis: 1,
  max_iters: 20,
  step_k: 0.1,
  hmax: 0.4,
  hmin_ratio: 0.1,
  hausd_ratio: 0.1,
  convergence_window: 5,
  convergence_rtol_jraw: 5e-2,
  ns_alpha_j: 0.5,
  ns_alpha_c: 0.5,
  surface_area_factor: 1.05,
  area_policy: "stable",
  accept_policy: "objective",
  area_correction_gain: 0.1,
  area_gram_rel_tol: 1e-3,
  adapt_size_map: true,
  adapt_h_near_factor: 2,
  adapt_h_far_factor: 1,
  adapt_r_near_factor: 1,
  adapt_r_far_factor: 0.5,
  adapt_gradation: 1.3,
  min_thickness: 0,
  min_thickness_samples: 4,
  min_thickness_active_tol: 0,
  min_thickness_inactive_tol: 0,
  min_thickness_correction_gain: 0.1,
  min_thickness_dual_tol: 1e-10,
  shift_x: 0,
  shift_y: 0,
  shift_z: 0,
  final_refine: true,
  final_hmax_factor: 0.1,
  final_hmin_ratio: 0.1,
  final_hausd_ratio: 3,
  final_rmc: 1e-4,
  smooth_steps: 1,
  smooth_eps_factor: 1,
  smooth_iso_shift: 0,
  feature_smooth_kappa_factor: 1,
  feature_smooth_min_weight: 0.08,
  camera_preset: "isometric",
  fps: 5,
  width: 960,
  height: 540,
  color_by: "solid",
  show_edges: false
};

function experiment(id: string, objective_sense: "min" | "max", objective_mode: "K" | "C" | "Q"): ExperimentSummary {
  return {
    id,
    config: {
      ...baseConfig,
      objective_sense,
      objective_mode
    },
    meta: {},
    summary: {},
    diagnostics: []
  };
}

const experiments = [
  experiment("min-k", "min", "K"),
  experiment("max-c", "max", "C"),
  experiment("max-q", "max", "Q")
];

assertDeepEqual(
  filterExperimentSummaries(experiments, { sense: "max", mode: "all", query: "" }).map((item) => item.id),
  ["max-c", "max-q"]
);

assertDeepEqual(
  filterExperimentSummaries(experiments, { sense: "all", mode: "Q", query: "" }).map((item) => item.id),
  ["max-q"]
);

assertDeepEqual(
  filterExperimentSummaries(experiments, { sense: "max", mode: "C", query: "sphere" }).map((item) => item.id),
  ["max-c"]
);
