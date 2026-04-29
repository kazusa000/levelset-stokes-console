import type { ExperimentSummary, ObjectiveMode, ObjectiveSense } from "./types";

export type ExperimentFilterValue<T extends string> = T | "all";

export type ExperimentFilters = {
  sense: ExperimentFilterValue<ObjectiveSense>;
  mode: ExperimentFilterValue<ObjectiveMode>;
  query: string;
};

export function filterExperimentSummaries(
  experiments: ExperimentSummary[],
  filters: ExperimentFilters
): ExperimentSummary[] {
  const query = filters.query.trim().toLowerCase();

  return experiments.filter((experiment) => {
    if (filters.sense !== "all" && experiment.config.objective_sense !== filters.sense) {
      return false;
    }
    if (filters.mode !== "all" && experiment.config.objective_mode !== filters.mode) {
      return false;
    }
    if (!query) {
      return true;
    }

    const haystack = [
      experiment.id,
      experiment.config.algorithm,
      experiment.config.initial_shape,
      experiment.config.objective_mode,
      experiment.config.objective_sense,
      experiment.summary.stage ?? ""
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}
