import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import FinalMeshViewer from "./FinalMeshViewer";
import type { ExperimentDetail, ExperimentSummary, FinalMeshData, JobConfig, MeshOption, PostSmoothConfig } from "./types";

type Locale = "zh" | "en";
type ViewMode = "create" | "experiment";

const defaultConfig: JobConfig = {
  dimension: "3d",
  algorithm: "v1",
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
  convergence_rtol_jraw: 5e-3,
  ns_alpha_j: 0.5,
  ns_alpha_c: 0.5,
  hilbert_alpha_factor: 16.0,
  surface_area_factor: 1.05,
  area_correction_gain: 0.1,
  area_gram_rel_tol: 1e-3,
  shift_x: 0.0,
  shift_y: 0.0,
  shift_z: 0.0,
  final_refine: true,
  final_hmax_factor: 0.1,
  final_hmin_ratio: 0.1,
  final_hausd_ratio: 3.0,
  final_rmc: 1e-4,
  smooth_steps: 1,
  smooth_eps_factor: 1.0,
  smooth_iso_shift: 0.0,
  feature_smooth_kappa_factor: 1.0,
  feature_smooth_min_weight: 0.08,
  penalty: 100,
  camera_preset: "isometric",
  fps: 5,
  width: 960,
  height: 540,
  color_by: "solid",
  show_edges: false
};

const ui = {
  zh: {
    subtitle: "本地实验控制台",
    newExperiment: "新建实验",
    model: "模型设置",
    solver: "求解设置",
    render: "动画设置",
    advanced: "高级参数",
    convergence: "收敛判据",
    runningQueue: "运行中任务",
    noRunningJobs: "当前没有运行中的任务。",
    stopJob: "停止该任务",
    favorite: "收藏",
    unfavorite: "取消收藏",
    favorites: "收藏夹",
    noFavorites: "当前没有收藏的实验。",
    recentExperiments: "最近实验",
    preset: "预设模板",
    choosePreset: "选择预设",
    dimension: "维度",
    algorithm: "算法",
    initialShape: "初始形状",
    objectiveMode: "目标模式",
    objectiveSense: "优化方向",
    unavailable: "暂不可用",
    shapePreview: "初始形状预览",
    currentTarget: "当前目标",
    axisI: "i 轴",
    axisJ: "j 轴",
    maxIters: "最大迭代",
    finalBeautify: "最终美化",
    finalRefine: "收敛后最终精细化",
    finalHmaxFactor: "最终 discretize hmax 系数",
    finalHminRatio: "最终 discretize hmin_ratio",
    finalHausdRatio: "最终 discretize hausd_ratio",
    finalRmc: "最终 discretize RMC",
    smoothSteps: "平滑步数",
    smoothEpsFactor: "平滑 eps 系数",
    smoothIsoShift: "平滑等值面偏移",
    smoothMode: "平滑模式",
    smoothModeGlobal: "普通平滑",
    smoothModeFeature: "特征保护",
    featureSmoothKappaFactor: "特征保护曲率系数",
    featureSmoothMinWeight: "特征保护最小权重",
    convergenceWindow: "收敛窗口",
    convergenceRtolJraw: "Jraw 收敛阈值",
    nsAlphaJ: "NS alphaJ 系数",
    nsAlphaC: "NS alphaC 系数",
    hilbertAlphaFactor: "Hilbert alpha 系数",
    surfaceAreaFactor: "面积上界倍率",
    areaCorrectionGain: "面积修正 gain",
    areaGramRelTol: "面积 Gram 相对阈值",
    shiftX: "整体平移 X",
    shiftY: "整体平移 Y",
    shiftZ: "整体平移 Z",
    camera: "相机角度",
    showEdges: "显示边",
    start: "启动任务",
    stop: "停止任务",
    savePreset: "保存预设",
    runningPreview: "运行与预览",
    running: "任务运行中",
    idle: "当前无运行任务",
    animationPreview: "动画预览",
    previewNote: "可随时切换角度；运行中可刷新当前角度预览，跑完后可为任意角度生成最终动画。",
    refreshPreview: "刷新当前角度预览",
    renderFinal: "生成当前角度最终动画",
    finalMeshViewer: "最终 3D 形状",
    meshToView: "选择 mesh",
    postSmoothOpen: "Smooth...",
    postSmoothPanel: "独立后处理 Smooth",
    postSmoothRun: "运行 Smooth",
    postSmoothRunning: "正在执行 Smooth...",
    postSmoothClose: "收起",
    postSmoothOriginal: "原始 final",
    postSmoothResult: "查看 smooth 版",
    postSmoothReady: "已生成当前 mesh 对应的 postsmooth 结果，可直接切换查看。",
    postSmoothUnavailable: "需要先有可用的 Final 3D mesh 才能执行独立 Smooth。",
    postSmoothSuccess: "已完成独立 Smooth。",
    postSmoothFailed: "独立 Smooth 失败",
    finalMeshVerifiedPostSmooth: "当前显示的是独立后处理生成的 Omega.postsmooth.mesh，不会覆盖原始 final mesh。",
    finalMeshSource: "来源",
    finalMeshSelection: "提取方式",
    experimentConfig: "实验参数",
    createFromConfig: "基于此参数新建实验",
    finalMeshVerifiedFinal: "当前显示的是 Omega.final.mesh，也就是算法最终后处理阶段保存的最终网格。",
    finalMeshFallback: "当前显示的不是 Omega.final.mesh，而是最后一个 Omega.N.mesh 回退结果。",
    finalMeshPending: "最终形状尚未可用。收敛并完成算法的最终后处理后会显示在这里。",
    noPreview: "还没有可用预览。运行几轮后或手动触发动画生成。",
    objectiveCurve: "Objective 曲线",
    volumeCurve: "Volume 曲线",
    noObjective: "暂无 objective 数据。",
    noVolume: "暂无 volume 数据。",
    logsHistory: "日志与历史",
    latestLog: "最新日志",
    noLog: "暂无日志",
    experiments: "历史实验",
    delete: "删除",
    confirmDelete: "确认删除",
    startFailed: "启动失败",
    stopFailed: "停止失败",
    renderFailed: "动画生成失败",
    deleteFailed: "删除实验失败",
    favoriteFailed: "更新收藏失败",
    presetName: "预设名称",
    savedPreset: (name: string) => `已保存预设：${name}`,
    refreshedPreview: (view: string) => `已刷新 ${view} 角度预览`,
    renderedFinal: (view: string) => `已生成 ${view} 角度最终动画`,
    deleteConfirm: (id: string) => `再次点击“确认删除”以删除实验 ${id}`,
    loadedConfigForCreate: "已载入该实验参数，可直接调整后启动。",
    metrics: { iteration: "Iteration", objective: "Objective", volume: "Volume", stage: "Stage", duration: "耗时" }
  },
  en: {
    subtitle: "Local experiment console",
    newExperiment: "New Experiment",
    model: "Model",
    solver: "Solver",
    render: "Rendering",
    advanced: "Advanced",
    convergence: "Convergence",
    runningQueue: "Running jobs",
    noRunningJobs: "No running jobs.",
    stopJob: "Stop job",
    favorite: "Favorite",
    unfavorite: "Unfavorite",
    favorites: "Favorites",
    noFavorites: "No favorited experiments.",
    recentExperiments: "Recent experiments",
    preset: "Preset",
    choosePreset: "Choose preset",
    dimension: "Dimension",
    algorithm: "Algorithm",
    initialShape: "Initial shape",
    objectiveMode: "Objective mode",
    objectiveSense: "Objective sense",
    unavailable: "unavailable",
    shapePreview: "Initial shape preview",
    currentTarget: "Current target",
    axisI: "i axis",
    axisJ: "j axis",
    maxIters: "Max iterations",
    finalBeautify: "Final beautify",
    finalRefine: "Final refine after convergence",
    finalHmaxFactor: "Final discretize hmax factor",
    finalHminRatio: "Final discretize hmin ratio",
    finalHausdRatio: "Final discretize hausd ratio",
    finalRmc: "Final discretize RMC",
    smoothSteps: "Smooth steps",
    smoothEpsFactor: "Smooth eps factor",
    smoothIsoShift: "Smooth iso shift",
    smoothMode: "Smooth mode",
    smoothModeGlobal: "Global",
    smoothModeFeature: "Feature-preserving",
    featureSmoothKappaFactor: "Feature kappa factor",
    featureSmoothMinWeight: "Feature min weight",
    convergenceWindow: "Convergence window",
    convergenceRtolJraw: "Jraw convergence rtol",
    nsAlphaJ: "NS alphaJ factor",
    nsAlphaC: "NS alphaC factor",
    hilbertAlphaFactor: "Hilbert alpha factor",
    surfaceAreaFactor: "Surface area factor",
    areaCorrectionGain: "Area correction gain",
    areaGramRelTol: "Area Gram relative tolerance",
    shiftX: "Global shift X",
    shiftY: "Global shift Y",
    shiftZ: "Global shift Z",
    camera: "Camera",
    showEdges: "Show edges",
    start: "Start",
    stop: "Stop",
    savePreset: "Save preset",
    runningPreview: "Run & Preview",
    running: "Job running",
    idle: "No active job",
    animationPreview: "Animation preview",
    previewNote: "Switch views at any time. Refresh the current preview while a run is active, or render a final animation for any view afterwards.",
    refreshPreview: "Refresh current preview",
    renderFinal: "Render final animation",
    finalMeshViewer: "Final 3D mesh",
    meshToView: "Mesh to view",
    postSmoothOpen: "Smooth...",
    postSmoothPanel: "Standalone post-smooth",
    postSmoothRun: "Run Smooth",
    postSmoothRunning: "Running smooth...",
    postSmoothClose: "Collapse",
    postSmoothOriginal: "Original final",
    postSmoothResult: "View smooth mesh",
    postSmoothReady: "A post-smoothed version of the selected mesh is available. You can switch to it directly.",
    postSmoothUnavailable: "A final 3D mesh is required before standalone smoothing can run.",
    postSmoothSuccess: "Standalone smooth finished.",
    postSmoothFailed: "Standalone smooth failed",
    finalMeshVerifiedPostSmooth: "This viewer is showing Omega.postsmooth.mesh from the standalone post-processing step. The original final mesh is preserved.",
    finalMeshSource: "Source",
    finalMeshSelection: "Selection",
    experimentConfig: "Experiment Config",
    createFromConfig: "Use Config for New Experiment",
    finalMeshVerifiedFinal: "This viewer is showing Omega.final.mesh, i.e. the mesh saved by the algorithm's final post-processing stage.",
    finalMeshFallback: "This viewer is not showing Omega.final.mesh. It is falling back to the last Omega.N.mesh.",
    finalMeshPending: "The final mesh is not available yet. It will appear here after convergence and the algorithm's final post-processing.",
    noPreview: "No preview available yet. Run a few iterations or trigger rendering manually.",
    objectiveCurve: "Objective curve",
    volumeCurve: "Volume curve",
    noObjective: "No objective data yet.",
    noVolume: "No volume data yet.",
    logsHistory: "Logs & History",
    latestLog: "Latest log",
    noLog: "No logs yet",
    experiments: "Experiments",
    delete: "Delete",
    confirmDelete: "Confirm delete",
    startFailed: "Failed to start job",
    stopFailed: "Failed to stop job",
    renderFailed: "Failed to render animation",
    deleteFailed: "Failed to delete experiment",
    favoriteFailed: "Failed to update favorite",
    presetName: "Preset name",
    savedPreset: (name: string) => `Saved preset: ${name}`,
    refreshedPreview: (view: string) => `Refreshed ${view} preview`,
    renderedFinal: (view: string) => `Rendered final ${view} animation`,
    deleteConfirm: (id: string) => `Click confirm again to delete experiment ${id}`,
    loadedConfigForCreate: "Loaded this experiment config into the new experiment form.",
    metrics: { iteration: "Iteration", objective: "Objective", volume: "Volume", stage: "Stage", duration: "Elapsed" }
  }
} as const;

function shapePreviewSvg(dimension: JobConfig["dimension"], shape: string): string {
  const base = `
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#dfe9f8"/>
        <stop offset="100%" stop-color="#a8c0eb"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="160" height="120" rx="18" fill="#f4f8fd"/>
    <rect x="10" y="10" width="140" height="100" rx="16" fill="#eef4fb" stroke="#d9e5f4"/>
  `;

  const silhouettes: Record<string, string> = {
    sphere: `<circle cx="80" cy="60" r="30" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    sphere_fine: `<circle cx="80" cy="60" r="30" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    sphere_bump: `<path d="M50,60c0,-17 13,-30 30,-30c16,0 28,10 30,24c10,0 18,8 18,17c0,10 -9,17 -20,17c-4,0 -8,-1 -11,-3c-5,3 -11,5 -17,5c-17,0 -30,-13 -30,-30z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    prolate: `<ellipse cx="80" cy="60" rx="24" ry="36" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    oblate: `<ellipse cx="80" cy="60" rx="36" ry="22" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    capsule: `<rect x="44" y="38" width="72" height="44" rx="22" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    double_sphere: `<path d="M52,60c0,-14 12,-25 27,-25c8,0 15,3 20,8c5,-5 12,-8 20,-8c15,0 27,11 27,25s-12,25 -27,25c-8,0 -15,-3 -20,-8c-5,5 -12,8 -20,8c-15,0 -27,-11 -27,-25z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    peanut: `<path d="M48,60c0,-18 14,-28 28,-28c8,0 14,3 18,8c4,-5 10,-8 18,-8c14,0 28,10 28,28s-14,28 -28,28c-8,0 -14,-3 -18,-8c-4,5 -10,8 -18,8c-14,0 -28,-10 -28,-28z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    dumbbell: `<circle cx="56" cy="60" r="22" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/><circle cx="104" cy="60" r="22" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/><rect x="56" y="49" width="48" height="22" rx="10" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    three_lobe: `<path d="M83,30c10,0 20,8 20,19c0,2 0,4 -1,6c9,2 18,10 18,21c0,13 -11,22 -24,22c-8,0 -14,-3 -19,-8c-4,5 -10,8 -18,8c-13,0 -23,-10 -23,-22c0,-12 8,-19 18,-21c-1,-2 -1,-4 -1,-6c0,-11 10,-19 20,-19c6,0 11,2 15,6c4,-4 9,-6 15,-6z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    rounded_three_lobe: `<path d="M84,31c8,0 15,4 19,10c11,1 21,9 21,21c0,13 -10,23 -24,23c-7,0 -13,-2 -18,-7c-4,4 -10,7 -17,7c-14,0 -25,-10 -25,-23c0,-12 9,-20 20,-21c4,-6 11,-10 18,-10c6,0 11,2 15,6c3,-4 7,-6 11,-6z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    rounded_four_lobe: `<path d="M80,30c8,0 14,5 16,12c12,0 20,8 20,19c0,10 -8,18 -18,20c-1,11 -9,19 -18,19c-9,0 -17,-8 -18,-19c-10,-2 -18,-10 -18,-20c0,-11 8,-19 20,-19c2,-7 8,-12 16,-12z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    seven_lobe_star: `<path d="M80,24c7,0 12,5 13,12c7,-1 13,2 16,8c7,1 12,6 12,13c0,6 -4,11 -9,13c1,8 -3,14 -10,17c-2,7 -8,11 -15,11c-5,0 -10,-2 -13,-7c-7,2 -14,0 -18,-5c-8,-1 -14,-7 -14,-14c0,-6 4,-12 10,-14c0,-7 4,-13 11,-15c3,-6 9,-9 17,-9z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    torus: `<circle cx="80" cy="60" r="31" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/><circle cx="80" cy="60" r="14" fill="#eef4fb" stroke="#4b6ea9" stroke-width="3"/>`,
    triaxial: `<path d="M44,66c0,-23 18,-36 40,-36c19,0 33,9 33,28c0,20 -15,32 -39,32c-21,0 -34,-9 -34,-24z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    circle: `<circle cx="80" cy="60" r="28" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    annulus: `<circle cx="80" cy="60" r="30" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/><circle cx="80" cy="60" r="13" fill="#eef4fb" stroke="#4b6ea9" stroke-width="3"/>`,
    eccentric_ring: `<ellipse cx="80" cy="60" rx="32" ry="26" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/><ellipse cx="92" cy="58" rx="16" ry="11" fill="#eef4fb" stroke="#4b6ea9" stroke-width="3"/>`,
    double_hole: `<ellipse cx="80" cy="60" rx="36" ry="28" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/><ellipse cx="67" cy="60" rx="11" ry="8" fill="#eef4fb" stroke="#4b6ea9" stroke-width="3"/><ellipse cx="93" cy="60" rx="11" ry="8" fill="#eef4fb" stroke="#4b6ea9" stroke-width="3"/>`
  };

  const fallback = `<path d="M46,66c0,-22 18,-34 36,-34c14,0 23,5 29,14c5,8 12,9 12,20c0,16 -15,27 -36,27c-26,0 -41,-11 -41,-27z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
      ${base}
      ${silhouettes[shape] ?? fallback}
    </svg>
  `;
}

function shapePreviewImagePath(dimension: JobConfig["dimension"], shape: string): string {
  return `/shape-previews/${dimension}/${shape}.png`;
}

function usePolling<T>(url: string, intervalMs: number, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let mounted = true;
    const tick = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = await response.json();
        if (mounted) {
          setData(payload);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "请求失败");
        }
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [url, intervalMs, enabled]);

  return { data, error, setData };
}

function patchDefaults(config: JobConfig): JobConfig {
  if (config.algorithm === "v2") {
    return {
      ...config,
      convergence_window: config.convergence_window ?? 5,
      convergence_rtol_jraw: config.convergence_rtol_jraw ?? 5e-3,
      ns_alpha_j: config.ns_alpha_j ?? 0.5,
      ns_alpha_c: config.ns_alpha_c ?? 0.5,
      penalty: undefined
    };
  }
  if (config.algorithm === "v4") {
    return {
      ...config,
      step_k: config.step_k ?? 0.1,
      convergence_window: config.convergence_window ?? 5,
      convergence_rtol_jraw: config.convergence_rtol_jraw ?? 5e-3,
      ns_alpha_j: config.ns_alpha_j ?? 0.5,
      ns_alpha_c: config.ns_alpha_c ?? 0.5,
      surface_area_factor: config.surface_area_factor ?? 1.05,
      final_refine: config.final_refine ?? true,
      final_hmax_factor: config.final_hmax_factor ?? 0.1,
      final_hmin_ratio: config.final_hmin_ratio ?? 0.1,
      final_hausd_ratio: config.final_hausd_ratio ?? 3.0,
      final_rmc: config.final_rmc ?? 1e-4,
      smooth_steps: config.smooth_steps ?? 1,
      smooth_eps_factor: config.smooth_eps_factor ?? 1.0,
      smooth_iso_shift: config.smooth_iso_shift ?? 0.0,
      penalty: undefined
    };
  }
  if (config.algorithm === "v6") {
    return {
      ...config,
      objective_mode: config.objective_mode ?? "C",
      objective_sense: config.objective_sense ?? "min",
      i_axis: config.i_axis ?? 0,
      j_axis: config.j_axis ?? 0,
      step_k: config.step_k ?? 0.1,
      convergence_window: config.convergence_window ?? 5,
      convergence_rtol_jraw: config.convergence_rtol_jraw ?? 5e-3,
      ns_alpha_j: config.ns_alpha_j ?? 0.5,
      ns_alpha_c: config.ns_alpha_c ?? 0.5,
      hilbert_alpha_factor: config.hilbert_alpha_factor ?? 16.0,
      surface_area_factor: config.surface_area_factor ?? 1.05,
      shift_x: config.shift_x ?? 0.0,
      shift_y: config.shift_y ?? 0.0,
      shift_z: config.shift_z ?? 0.0,
      penalty: undefined
    };
  }
  if (config.algorithm === "v7") {
    return {
      ...config,
      objective_mode: config.objective_mode ?? "C",
      objective_sense: config.objective_sense ?? "min",
      i_axis: config.i_axis ?? 0,
      j_axis: config.j_axis ?? 0,
      step_k: config.step_k ?? 0.1,
      convergence_window: config.convergence_window ?? 5,
      convergence_rtol_jraw: config.convergence_rtol_jraw ?? 5e-3,
      ns_alpha_j: config.ns_alpha_j ?? 0.5,
      ns_alpha_c: config.ns_alpha_c ?? 0.5,
      surface_area_factor: config.surface_area_factor ?? 1.05,
      shift_x: config.shift_x ?? 0.0,
      shift_y: config.shift_y ?? 0.0,
      shift_z: config.shift_z ?? 0.0,
      final_refine: config.final_refine ?? true,
      final_hmax_factor: config.final_hmax_factor ?? 0.1,
      final_hmin_ratio: config.final_hmin_ratio ?? 0.1,
      final_hausd_ratio: config.final_hausd_ratio ?? 3.0,
      final_rmc: config.final_rmc ?? 1e-4,
      smooth_steps: config.smooth_steps ?? 1,
      smooth_eps_factor: config.smooth_eps_factor ?? 0.1,
      smooth_iso_shift: config.smooth_iso_shift ?? 0.0,
      penalty: undefined
    };
  }
  if (config.algorithm === "v8") {
    return {
      ...config,
      objective_mode: config.objective_mode ?? "C",
      objective_sense: config.objective_sense ?? "min",
      i_axis: config.i_axis ?? 0,
      j_axis: config.j_axis ?? 0,
      step_k: config.step_k ?? 0.1,
      convergence_window: config.convergence_window ?? 5,
      convergence_rtol_jraw: config.convergence_rtol_jraw ?? 5e-3,
      ns_alpha_j: config.ns_alpha_j ?? 0.5,
      ns_alpha_c: config.ns_alpha_c ?? 0.5,
      surface_area_factor: config.surface_area_factor ?? 1.05,
      shift_x: config.shift_x ?? 0.0,
      shift_y: config.shift_y ?? 0.0,
      shift_z: config.shift_z ?? 0.0,
      final_refine: config.final_refine ?? true,
      final_hmax_factor: config.final_hmax_factor ?? 0.1,
      final_hmin_ratio: config.final_hmin_ratio ?? 0.1,
      final_hausd_ratio: config.final_hausd_ratio ?? 3.0,
      final_rmc: config.final_rmc ?? 1e-4,
      smooth_steps: config.smooth_steps ?? 1,
      smooth_eps_factor: config.smooth_eps_factor ?? 1.0,
      smooth_iso_shift: config.smooth_iso_shift ?? 0.0,
      feature_smooth_kappa_factor: config.feature_smooth_kappa_factor ?? 1.0,
      feature_smooth_min_weight: config.feature_smooth_min_weight ?? 0.08,
      penalty: undefined
    };
  }
  if (config.algorithm === "v9") {
    return {
      ...config,
      objective_mode: config.objective_mode ?? "C",
      objective_sense: config.objective_sense ?? "min",
      i_axis: config.i_axis ?? 0,
      j_axis: config.j_axis ?? 0,
      step_k: config.step_k ?? 0.1,
      convergence_window: config.convergence_window ?? 5,
      convergence_rtol_jraw: config.convergence_rtol_jraw ?? 5e-3,
      ns_alpha_j: config.ns_alpha_j ?? 0.5,
      ns_alpha_c: config.ns_alpha_c ?? 0.5,
      surface_area_factor: config.surface_area_factor ?? 1.05,
      area_correction_gain: config.area_correction_gain ?? 0.1,
      area_gram_rel_tol: config.area_gram_rel_tol ?? 1e-3,
      shift_x: config.shift_x ?? 0.0,
      shift_y: config.shift_y ?? 0.0,
      shift_z: config.shift_z ?? 0.0,
      penalty: undefined
    };
  }
  if (config.algorithm === "v10_test" || config.algorithm === "v11_test") {
    return {
      ...config,
      objective_mode: config.objective_mode ?? "C",
      objective_sense: config.objective_sense ?? "min",
      i_axis: config.i_axis ?? 0,
      j_axis: config.j_axis ?? 0,
      step_k: config.step_k ?? 0.1,
      convergence_window: config.convergence_window ?? 5,
      convergence_rtol_jraw: config.convergence_rtol_jraw ?? (config.algorithm === "v11_test" ? 5e-2 : 5e-3),
      ns_alpha_j: config.ns_alpha_j ?? 0.5,
      ns_alpha_c: config.ns_alpha_c ?? 0.5,
      surface_area_factor: config.surface_area_factor ?? 1.05,
      shift_x: config.shift_x ?? 0.0,
      shift_y: config.shift_y ?? 0.0,
      shift_z: config.shift_z ?? 0.0,
      penalty: undefined
    };
  }
  if (config.algorithm === "v5") {
    return {
      ...config,
      objective_mode: config.objective_mode ?? "C",
      objective_sense: config.objective_sense ?? "min",
      i_axis: config.i_axis ?? 0,
      j_axis: config.j_axis ?? 0,
      step_k: config.step_k ?? 0.1,
      convergence_window: config.convergence_window ?? 5,
      convergence_rtol_jraw: config.convergence_rtol_jraw ?? 5e-3,
      ns_alpha_j: config.ns_alpha_j ?? 0.5,
      ns_alpha_c: config.ns_alpha_c ?? 0.5,
      shift_x: config.shift_x ?? 0.0,
      shift_y: config.shift_y ?? 0.0,
      shift_z: config.shift_z ?? 0.0,
      final_refine: config.final_refine ?? true,
      final_hmax_factor: config.final_hmax_factor ?? 0.1,
      final_hmin_ratio: config.final_hmin_ratio ?? 0.1,
      final_hausd_ratio: config.final_hausd_ratio ?? 3.0,
      final_rmc: config.final_rmc ?? 1e-4,
      smooth_steps: config.smooth_steps ?? 1,
      smooth_eps_factor: config.smooth_eps_factor ?? 1.0,
      smooth_iso_shift: config.smooth_iso_shift ?? 0.0,
      penalty: undefined
    };
  }
  if (config.algorithm === "v3") {
    return {
      ...config,
      step_k: config.step_k ?? 0.2,
      convergence_window: config.convergence_window ?? 5,
      convergence_rtol_jraw: config.convergence_rtol_jraw ?? 5e-2,
      ns_alpha_j: config.ns_alpha_j ?? 0.5,
      ns_alpha_c: config.ns_alpha_c ?? 0.5,
      final_refine: config.final_refine ?? true,
      final_hmax_factor: config.final_hmax_factor ?? 0.1,
      final_hmin_ratio: config.final_hmin_ratio ?? 0.1,
      final_hausd_ratio: config.final_hausd_ratio ?? 3.0,
      final_rmc: config.final_rmc ?? 1e-4,
      smooth_steps: config.smooth_steps ?? 1,
      smooth_eps_factor: config.smooth_eps_factor ?? 1.0,
      smooth_iso_shift: config.smooth_iso_shift ?? 0.0,
      penalty: undefined
    };
  }
  return {
    ...config,
    penalty: config.penalty ?? 100
  };
}

async function postJson<T>(url: string, payload?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function formatTarget(
  config: Pick<JobConfig, "objective_mode" | "i_axis" | "j_axis"> & Partial<Pick<JobConfig, "objective_sense">>
): string {
  const sense = config.objective_sense ?? "min";
  return `${sense} ${config.objective_mode}_${config.i_axis}${config.j_axis}`;
}

function formatHmax(config: Pick<JobConfig, "hmax">): string {
  return `hmax=${config.hmax}`;
}

function formatDuration(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) {
    return "-";
  }
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(secs).padStart(2, "0")}s`;
  }
  return `${secs}s`;
}

function buildPostSmoothConfig(detail: ExperimentDetail | null): PostSmoothConfig {
  return {
    mesh_name: detail?.postsmooth_config?.mesh_name ?? null,
    final_hmax_factor: detail?.postsmooth_config?.final_hmax_factor ?? detail?.config.final_hmax_factor ?? 0.1,
    final_hmin_ratio: detail?.postsmooth_config?.final_hmin_ratio ?? detail?.config.final_hmin_ratio ?? 0.1,
    final_hausd_ratio: detail?.postsmooth_config?.final_hausd_ratio ?? detail?.config.final_hausd_ratio ?? 3.0,
    final_rmc: detail?.postsmooth_config?.final_rmc ?? detail?.config.final_rmc ?? 1e-4,
    smooth_steps: detail?.postsmooth_config?.smooth_steps ?? detail?.config.smooth_steps ?? 1,
    smooth_eps_factor: detail?.postsmooth_config?.smooth_eps_factor ?? detail?.config.smooth_eps_factor ?? 1.0,
    smooth_iso_shift: detail?.postsmooth_config?.smooth_iso_shift ?? detail?.config.smooth_iso_shift ?? 0.0,
    smooth_mode: detail?.postsmooth_config?.smooth_mode ?? "global",
    feature_smooth_kappa_factor:
      detail?.postsmooth_config?.feature_smooth_kappa_factor ?? detail?.config.feature_smooth_kappa_factor ?? 0.1,
    feature_smooth_min_weight:
      detail?.postsmooth_config?.feature_smooth_min_weight ?? detail?.config.feature_smooth_min_weight ?? 0.08
  };
}

function smoothNameForMesh(meshName: string | null): string | null {
  if (!meshName) {
    return null;
  }
  if (meshName === "Omega.final.mesh") {
    return "Omega.final.postsmooth.mesh";
  }
  const iterMatch = /^Omega\.(\d+)\.mesh$/.exec(meshName);
  if (iterMatch) {
    return `Omega.${iterMatch[1]}.postsmooth.mesh`;
  }
  return meshName.endsWith(".mesh") ? `${meshName.slice(0, -5)}.postsmooth.mesh` : null;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const stored = window.localStorage.getItem("levelset-console-locale");
    return stored === "en" ? "en" : "zh";
  });
  const { data: configData } = usePolling<any>("/api/config", 10000);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("create");
  const jobsUrl = useMemo(
    () => `/api/jobs${selectedExperimentId ? `?focus=${encodeURIComponent(selectedExperimentId)}` : ""}`,
    [selectedExperimentId]
  );
  const { data: jobsData, error: currentError, setData: setJobsData } = usePolling<{ running: ExperimentDetail[] }>(
    jobsUrl,
    2500
  );
  const { data: experimentsData, error: experimentsError, setData: setExperimentsData } = usePolling<
    ExperimentSummary[]
  >("/api/experiments", 5000);

  const [form, setForm] = useState<JobConfig>(defaultConfig);
  const [postSmoothForm, setPostSmoothForm] = useState<PostSmoothConfig>(() => buildPostSmoothConfig(null));
  const [busy, setBusy] = useState(false);
  const [postSmoothBusy, setPostSmoothBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [shapePreviewFailed, setShapePreviewFailed] = useState(false);
  const [showPostSmoothPanel, setShowPostSmoothPanel] = useState(false);
  const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);
  const [sectionOpen, setSectionOpen] = useState({
    running: true,
    favorites: true,
    recent: true
  });
  const t = ui[locale];

  const runningExperiments = jobsData?.running ?? [];
  const runningIds = useMemo(() => new Set(runningExperiments.map((job) => job.id)), [runningExperiments]);
  const favoriteExperiments = useMemo(
    () => (experimentsData ?? []).filter((experiment) => Boolean(experiment.meta?.favorite)),
    [experimentsData]
  );
  const recentExperiments = useMemo(
    () => (experimentsData ?? []).filter((experiment) => !experiment.meta?.favorite),
    [experimentsData]
  );
  const activeRunning = useMemo(
    () => runningExperiments.find((job) => job.id === selectedExperimentId) ?? null,
    [runningExperiments, selectedExperimentId]
  );
  const detailUrl = useMemo(
    () => (selectedExperimentId ? `/api/experiments/${encodeURIComponent(selectedExperimentId)}` : ""),
    [selectedExperimentId]
  );
  const shouldPollDetail = Boolean(selectedExperimentId && runningIds.has(selectedExperimentId));
  const { data: detailData, error: detailError, setData: setDetailData } = usePolling<ExperimentDetail>(
    detailUrl,
    2500,
    shouldPollDetail
  );

  const shapes = useMemo(() => configData?.shapes?.[form.dimension] ?? [], [configData, form.dimension]);
  const presets = configData?.presets ?? [];
  const cameraOptions = configData?.camera_presets?.[form.dimension] ?? ["default"];
  const axisOptions = [0, 1, 2];
  const objectiveModes = configData?.objective_modes ?? [
    { key: "K", enabled: true },
    { key: "C", enabled: true },
    { key: "Q", enabled: true }
  ];
  const objectiveSenses = configData?.objective_senses ?? ["min", "max"];
  const supportsC =
    form.algorithm === "v1" ||
    form.algorithm === "v2" ||
    form.algorithm === "v3" ||
    form.algorithm === "v4" ||
    form.algorithm === "v5" ||
    form.algorithm === "v6" ||
    form.algorithm === "v7" ||
    form.algorithm === "v8" ||
    form.algorithm === "v9" ||
    form.algorithm === "v10_test" ||
    form.algorithm === "v11_test";
  const supportsQ =
    form.algorithm === "v1" ||
    form.algorithm === "v2" ||
    form.algorithm === "v3" ||
    form.algorithm === "v4" ||
    form.algorithm === "v5" ||
    form.algorithm === "v6" ||
    form.algorithm === "v7" ||
    form.algorithm === "v8" ||
    form.algorithm === "v9" ||
    form.algorithm === "v10_test" ||
    form.algorithm === "v11_test";
  const supportsObjectiveSense =
    form.algorithm === "v1" ||
    form.algorithm === "v2" ||
    form.algorithm === "v3" ||
    form.algorithm === "v4" ||
    form.algorithm === "v5" ||
    form.algorithm === "v6" ||
    form.algorithm === "v7" ||
    form.algorithm === "v8" ||
    form.algorithm === "v9" ||
    form.algorithm === "v10_test" ||
    form.algorithm === "v11_test";
  const selectedShape = shapes.find((shape: any) => shape.key === form.initial_shape) ?? null;
  const shapePreviewSvgUrl = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(shapePreviewSvg(form.dimension, form.initial_shape))}`,
    [form.dimension, form.initial_shape]
  );
  const shapePreviewImage = useMemo(
    () => shapePreviewImagePath(form.dimension, form.initial_shape),
    [form.dimension, form.initial_shape]
  );

  useEffect(() => {
    setShapePreviewFailed(false);
  }, [form.dimension, form.initial_shape]);

  useEffect(() => {
    window.localStorage.setItem("levelset-console-locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    if (!shapes.length) {
      return;
    }
    if (!shapes.some((shape: any) => shape.key === form.initial_shape)) {
      setForm((prev) => ({ ...prev, initial_shape: shapes[0].key }));
    }
  }, [shapes, form.initial_shape]);

  useEffect(() => {
    if (form.objective_mode === "C" && !supportsC) {
      setForm((prev) => ({ ...prev, objective_mode: "K" }));
    }
  }, [form.objective_mode, supportsC]);

  useEffect(() => {
    if (form.objective_mode === "Q" && !supportsQ) {
      setForm((prev) => ({ ...prev, objective_mode: "K" }));
    }
  }, [form.objective_mode, supportsQ]);

  useEffect(() => {
    if (form.objective_sense === "max" && !supportsObjectiveSense) {
      setForm((prev) => ({ ...prev, objective_sense: "min" }));
    }
  }, [form.objective_sense, supportsObjectiveSense]);

  useEffect(() => {
    if (!selectedExperimentId && viewMode === "experiment") {
      if (runningExperiments.length) {
        setSelectedExperimentId(runningExperiments[0].id);
        return;
      }
      if (experimentsData?.length) {
        setSelectedExperimentId(experimentsData[0].id);
      }
      return;
    } else if (!selectedExperimentId) {
      return;
    }

    const selectedExists =
      runningIds.has(selectedExperimentId) ||
      Boolean(experimentsData?.some((experiment) => experiment.id === selectedExperimentId));
    if (!selectedExists) {
      if (runningExperiments.length) {
        setSelectedExperimentId(runningExperiments[0].id);
      } else if (experimentsData?.length) {
        setSelectedExperimentId(experimentsData[0].id);
      } else {
        setSelectedExperimentId(null);
      }
    }
  }, [selectedExperimentId, runningExperiments, runningIds, experimentsData, viewMode]);

  const activeDetail = activeRunning ?? detailData ?? null;
  const objectiveSeries = activeDetail?.series?.["obj.txt"];
  const volumeSeries = activeDetail?.series?.["vol.txt"];
  const activeCameraUrl =
    activeDetail?.preview_urls?.[form.camera_preset] ?? activeDetail?.final_urls?.[form.camera_preset] ?? null;
  const supportsFinalMesh =
    activeDetail?.config.dimension === "3d" &&
    (
      activeDetail?.config.algorithm === "v2" ||
      activeDetail?.config.algorithm === "v3" ||
      activeDetail?.config.algorithm === "v4" ||
      activeDetail?.config.algorithm === "v5" ||
      activeDetail?.config.algorithm === "v6" ||
      activeDetail?.config.algorithm === "v7" ||
      activeDetail?.config.algorithm === "v8" ||
      activeDetail?.config.algorithm === "v9" ||
      activeDetail?.config.algorithm === "v10_test" ||
      activeDetail?.config.algorithm === "v11_test"
    );
  const meshOptions: MeshOption[] = supportsFinalMesh ? activeDetail?.mesh_options ?? [] : [];
  const defaultMeshName =
    meshOptions.find((option) => option.is_default)?.name ?? meshOptions[0]?.name ?? null;
  const effectiveMeshName =
    selectedMeshName && meshOptions.some((option) => option.name === selectedMeshName)
      ? selectedMeshName
      : defaultMeshName;
  const selectedMeshOption =
    meshOptions.find((option) => option.name === effectiveMeshName) ?? null;
  const selectedSmoothName =
    selectedMeshOption?.smooth_name ?? smoothNameForMesh(effectiveMeshName);
  const selectedSmoothOption =
    selectedSmoothName ? meshOptions.find((option) => option.name === selectedSmoothName) ?? null : null;
  const displayedMeshUrl =
    supportsFinalMesh && activeDetail?.id && effectiveMeshName
      ? `/api/experiments/${encodeURIComponent(activeDetail.id)}/mesh?name=${encodeURIComponent(effectiveMeshName)}`
      : null;
  const [finalMeshData, setFinalMeshData] = useState<FinalMeshData | null>(null);
  const [finalMeshError, setFinalMeshError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedExperimentId || !detailUrl || shouldPollDetail) {
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const response = await fetch(detailUrl);
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = await response.json();
        if (mounted) {
          setDetailData(payload);
        }
      } catch (error) {
        if (mounted) {
          setMessage(error instanceof Error ? error.message : t.startFailed);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedExperimentId, detailUrl, shouldPollDetail, setDetailData, t.startFailed]);

  useEffect(() => {
    if (!displayedMeshUrl) {
      setFinalMeshData(null);
      setFinalMeshError(null);
      return;
    }

    let mounted = true;
    setFinalMeshError(null);
    void (async () => {
      try {
        const response = await fetch(displayedMeshUrl);
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = await response.json();
        if (mounted) {
          setFinalMeshData(payload);
          setFinalMeshError(null);
        }
      } catch (error) {
        if (mounted) {
          setFinalMeshData(null);
          setFinalMeshError(error instanceof Error ? error.message : "请求失败");
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [displayedMeshUrl]);

  useEffect(() => {
    setShowPostSmoothPanel(false);
    setSelectedMeshName(null);
    setPostSmoothForm(buildPostSmoothConfig(activeDetail));
  }, [activeDetail?.id]);

  useEffect(() => {
    if (!meshOptions.length) {
      setSelectedMeshName(null);
      return;
    }
    if (!selectedMeshName || !meshOptions.some((option) => option.name === selectedMeshName)) {
      setSelectedMeshName(defaultMeshName);
    }
  }, [meshOptions, selectedMeshName, defaultMeshName]);

  const handleStart = async () => {
    try {
      setBusy(true);
      setMessage("");
      const payload = patchDefaults(form);
      const response = await postJson<ExperimentDetail>("/api/jobs", payload);
      setSelectedExperimentId(response.id);
      setViewMode("experiment");
      setDetailData(response);
      setJobsData((prev) => {
        const running = [response, ...(prev?.running ?? []).filter((job) => job.id !== response.id)];
        return { running };
      });
      const experiments = await fetch("/api/experiments").then((res) => res.json());
      setExperimentsData(experiments);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.startFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async (experimentId: string) => {
    try {
      setBusy(true);
      await postJson(`/api/jobs/${experimentId}/stop`);
      const [jobs, experiments] = await Promise.all([
        fetch(`/api/jobs${selectedExperimentId ? `?focus=${encodeURIComponent(selectedExperimentId)}` : ""}`).then((res) => res.json()),
        fetch("/api/experiments").then((res) => res.json())
      ]);
      setJobsData(jobs);
      setExperimentsData(experiments);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.stopFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleRender = async (final: boolean, experimentId?: string) => {
    try {
      setBusy(true);
      const targetId = experimentId ?? selectedExperimentId;
      if (!targetId) {
        throw new Error("No selected experiment.");
      }
      const url = runningIds.has(targetId)
        ? `/api/jobs/${targetId}/render`
        : `/api/experiments/${targetId}/render`;
      const result = await postJson<ExperimentDetail>(url, {
        camera_preset: form.camera_preset,
        final
      });
      setDetailData(result);
      setJobsData((prev) => {
        if (!prev?.running?.length) return prev ?? { running: [] };
        return {
          running: prev.running.map((job) => (job.id === result.id ? result : job))
        };
      });
      setMessage(final ? t.renderedFinal(form.camera_preset) : t.refreshedPreview(form.camera_preset));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.renderFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleRunPostSmooth = async () => {
    try {
      const targetId = activeDetail?.id ?? selectedExperimentId;
      if (!targetId) {
        throw new Error("No selected experiment.");
      }
      if (!effectiveMeshName) {
        throw new Error(t.postSmoothUnavailable);
      }
      setPostSmoothBusy(true);
      setMessage("");
      const result = await postJson<ExperimentDetail>(
        `/api/experiments/${encodeURIComponent(targetId)}/post-smooth`,
        { ...postSmoothForm, mesh_name: effectiveMeshName }
      );
      setDetailData(result);
      const nextMeshName = smoothNameForMesh(effectiveMeshName);
      if (nextMeshName) {
        setSelectedMeshName(nextMeshName);
      }
      setMessage(t.postSmoothSuccess);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.postSmoothFailed);
    } finally {
      setPostSmoothBusy(false);
    }
  };

  const handleDeleteExperiment = async (id: string) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      setMessage(t.deleteConfirm(id));
      return;
    }

    try {
      setBusy(true);
      setMessage("");
      const response = await fetch(`/api/experiments/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const experiments = await fetch("/api/experiments").then((res) => res.json());
      setExperimentsData(experiments);
      setPendingDeleteId(null);
      if (selectedExperimentId === id) {
        setSelectedExperimentId(null);
        setDetailData(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.deleteFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleFavoriteExperiment = async (id: string, favorite: boolean) => {
    try {
      setBusy(true);
      const updated = await postJson<ExperimentDetail>(`/api/experiments/${id}/favorite`, { favorite });
      setExperimentsData((prev) => {
        const next = (prev ?? []).map((experiment) => (experiment.id === id ? updated : experiment));
        next.sort((a, b) => {
          const af = a.meta?.favorite ? 1 : 0;
          const bf = b.meta?.favorite ? 1 : 0;
          return bf - af;
        });
        return next;
      });
      if (selectedExperimentId === id && !runningIds.has(id)) {
        setDetailData(updated);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.favoriteFailed);
    } finally {
      setBusy(false);
    }
  };

  const toggleSection = (key: "running" | "favorites" | "recent") => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePresetLoad = (name: string) => {
    const preset = presets.find((item: any) => item.name === name);
    if (!preset) {
      return;
    }
    setForm({ ...defaultConfig, ...preset.config, mesh_path: null });
  };

  const handlePresetSave = async () => {
    const name = window.prompt(t.presetName);
    if (!name) {
      return;
    }
    await postJson("/api/presets", { name, config: form });
    setMessage(t.savedPreset(name));
  };

  const handleCreateFromConfig = () => {
    if (!activeDetail?.config) {
      return;
    }

    setForm(patchDefaults({ ...defaultConfig, ...activeDetail.config }));
    setPendingDeleteId(null);
    setViewMode("create");
    setMessage(t.loadedConfigForCreate);
  };

  return (
    <div className="app-shell">
      <aside className="panel task-nav">
        <div className="section-header">
          <h1>LevelSetStokes Console</h1>
          <div className="header-row">
            <p>{t.subtitle}</p>
            <div className="lang-switch">
              <button className={locale === "zh" ? "secondary" : ""} onClick={() => setLocale("zh")}>中文</button>
              <button className={locale === "en" ? "secondary" : ""} onClick={() => setLocale("en")}>EN</button>
            </div>
          </div>
        </div>

        <button
          className={`nav-create-button ${viewMode === "create" ? "active" : ""}`}
          onClick={() => {
            setPendingDeleteId(null);
            setViewMode("create");
          }}
        >
          <strong>{t.newExperiment}</strong>
        </button>

        <div className="nav-section">
          <button className="nav-section-toggle" onClick={() => toggleSection("running")}>
            <h3>{t.runningQueue}</h3>
            <span>{sectionOpen.running ? "▾" : "▸"}</span>
          </button>
          {sectionOpen.running ? (runningExperiments.length ? (
            <div className="running-list nav-list">
              {runningExperiments.map((job) => (
                <div
                  key={job.id}
                  className={`running-item ${selectedExperimentId === job.id ? "active" : ""}`}
                >
                  <button
                  className="history-main"
                  onClick={() => {
                      setPendingDeleteId(null);
                      setViewMode("experiment");
                      setSelectedExperimentId(job.id);
                    }}
                  >
                    <strong>
                      {job.config.dimension.toUpperCase()} / {job.config.algorithm} / {job.config.initial_shape}
                    </strong>
                    <span>
                      {formatTarget(job.config)} · it={job.summary.iteration ?? "-"}
                    </span>
                    <span>{formatHmax(job.config)} · {job.summary.stage ?? String(job.meta.status ?? "running")}</span>
                    <span>{t.metrics.duration}: {formatDuration(job.summary.duration_seconds)}</span>
                  </button>
                  <button
                    className="history-delete danger"
                    disabled={busy}
                    onClick={() => void handleStop(job.id)}
                  >
                    {t.stopJob}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="placeholder">{t.noRunningJobs}</div>
          )) : null}
        </div>

        <div className="nav-section">
          <button className="nav-section-toggle" onClick={() => toggleSection("favorites")}>
            <h3>{t.favorites}</h3>
            <span>{sectionOpen.favorites ? "▾" : "▸"}</span>
          </button>
          {sectionOpen.favorites ? (favoriteExperiments.length ? (
          <div className="history-list nav-list">
            {favoriteExperiments.map((experiment) => (
              <div
                key={experiment.id}
                className={`history-item ${selectedExperimentId === experiment.id ? "active" : ""}`}
              >
                <button
                  className="history-main"
                  onClick={() => {
                    setPendingDeleteId(null);
                    setViewMode("experiment");
                    setSelectedExperimentId(experiment.id);
                  }}
                >
                  <strong>
                    {experiment.config.dimension.toUpperCase()} / {experiment.config.algorithm} / {experiment.config.initial_shape}
                  </strong>
                  <span>{formatTarget(experiment.config)} · {formatHmax(experiment.config)}</span>
                  <span>{t.metrics.duration}: {formatDuration(experiment.summary.duration_seconds)}</span>
                </button>
                <button
                  className={`history-favorite ${experiment.meta?.favorite ? "active" : ""}`}
                  disabled={busy}
                  title={experiment.meta?.favorite ? t.unfavorite : t.favorite}
                  onClick={() => void handleFavoriteExperiment(experiment.id, !Boolean(experiment.meta?.favorite))}
                >
                  {experiment.meta?.favorite ? "★" : "☆"}
                </button>
                <button
                  className="history-delete danger"
                  disabled={busy || runningIds.has(experiment.id)}
                  onClick={() => void handleDeleteExperiment(experiment.id)}
                >
                  {pendingDeleteId === experiment.id ? t.confirmDelete : t.delete}
                </button>
              </div>
            ))}
          </div>
          ) : (
            <div className="placeholder">{t.noFavorites}</div>
          )) : null}
        </div>

        <div className="nav-section">
          <button className="nav-section-toggle" onClick={() => toggleSection("recent")}>
            <h3>{t.recentExperiments}</h3>
            <span>{sectionOpen.recent ? "▾" : "▸"}</span>
          </button>
          {sectionOpen.recent ? (
          <div className="history-list nav-list">
            {recentExperiments.map((experiment) => (
              <div
                key={experiment.id}
                className={`history-item ${selectedExperimentId === experiment.id ? "active" : ""}`}
              >
                <button
                  className="history-main"
                  onClick={() => {
                    setPendingDeleteId(null);
                    setViewMode("experiment");
                    setSelectedExperimentId(experiment.id);
                  }}
                >
                  <strong>
                    {experiment.config.dimension.toUpperCase()} / {experiment.config.algorithm} / {experiment.config.initial_shape}
                  </strong>
                  <span>{formatTarget(experiment.config)} · {formatHmax(experiment.config)}</span>
                  <span>{t.metrics.duration}: {formatDuration(experiment.summary.duration_seconds)}</span>
                </button>
                <button
                  className={`history-favorite ${experiment.meta?.favorite ? "active" : ""}`}
                  disabled={busy}
                  title={experiment.meta?.favorite ? t.unfavorite : t.favorite}
                  onClick={() => void handleFavoriteExperiment(experiment.id, !Boolean(experiment.meta?.favorite))}
                >
                  {experiment.meta?.favorite ? "★" : "☆"}
                </button>
                <button
                  className="history-delete danger"
                  disabled={busy || runningIds.has(experiment.id)}
                  onClick={() => void handleDeleteExperiment(experiment.id)}
                >
                  {pendingDeleteId === experiment.id ? t.confirmDelete : t.delete}
                </button>
              </div>
            ))}
          </div>
          ) : null}
        </div>
      </aside>

      <main className="panel workspace">
        {viewMode === "create" ? (
          <div className="param-panel">
            <div className="section-header">
              <h2>{t.newExperiment}</h2>
            </div>

            <div className="param-section">
              <div className="param-section-title">{t.model}</div>
              <div className="param-grid">
                <label className="field-span-2">
                  {t.preset}
                  <select onChange={(e) => handlePresetLoad(e.target.value)} defaultValue="">
                    <option value="">{t.choosePreset}</option>
                    {presets.map((preset: any) => (
                      <option key={preset.name} value={preset.name}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  {t.dimension}
                  <select disabled={true} value={form.dimension}>
                    <option value="3d">3D</option>
                  </select>
                </label>

                <label>
                  {t.algorithm}
                  <select
                    disabled={busy}
                    value={form.algorithm}
                    onChange={(e) => {
                      const algorithm = e.target.value as JobConfig["algorithm"];
                      setForm((prev) =>
                        patchDefaults({
                          ...prev,
                          algorithm,
                          convergence_rtol_jraw: algorithm === "v11_test" ? 5e-2 : prev.convergence_rtol_jraw,
                          smooth_eps_factor: algorithm === "v7" ? 0.1 : prev.smooth_eps_factor
                        })
                      );
                    }}
                  >
                    <option value="v1">3Dv1</option>
                    <option value="v2">3Dv2</option>
                    <option value="v3">3Dv3</option>
                    <option value="v4">3Dv4</option>
                    <option value="v5">3Dv5</option>
                    <option value="v6">3Dv6</option>
                    <option value="v7">3Dv7</option>
                    <option value="v8">3Dv8</option>
                    <option value="v9">3Dv9</option>
                    <option value="v10_test">3Dv10_test</option>
                    <option value="v11_test">3Dv11_test</option>
                  </select>
                </label>

                <label className="field-span-2">
                  {t.initialShape}
                  <select
                    disabled={busy}
                    value={form.initial_shape}
                    onChange={(e) => setForm((prev) => ({ ...prev, initial_shape: e.target.value, mesh_path: null }))}
                  >
                    {shapes.map((shape: any) => (
                      <option key={shape.key} value={shape.key}>
                        {shape.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="shape-preview-card field-span-2">
                  <img
                    className="shape-preview-image"
                    src={shapePreviewFailed ? shapePreviewSvgUrl : shapePreviewImage}
                    alt={`${form.initial_shape} preview`}
                    onError={() => setShapePreviewFailed(true)}
                  />
                  <div className="shape-preview-meta">
                    <strong>{selectedShape?.label ?? form.initial_shape}</strong>
                    <span>{form.dimension.toUpperCase()} {t.shapePreview}</span>
                  </div>
                </div>

                <label>
                  {t.objectiveMode}
                  <select
                    disabled={busy}
                    value={form.objective_mode}
                    onChange={(e) => setForm((prev) => ({ ...prev, objective_mode: e.target.value as JobConfig["objective_mode"] }))}
                  >
                    {objectiveModes.map((mode: any) => {
                      const supported =
                        mode.key === "K" ? true :
                        mode.key === "C" ? supportsC :
                        mode.key === "Q" ? supportsQ :
                        false;
                      return (
                        <option key={mode.key} value={mode.key} disabled={!supported || !mode.enabled}>
                          {mode.key}
                          {!supported || !mode.enabled ? ` (${t.unavailable})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label>
                  {t.objectiveSense}
                  <select
                    disabled={busy}
                    value={form.objective_sense}
                    onChange={(e) => setForm((prev) => ({ ...prev, objective_sense: e.target.value as JobConfig["objective_sense"] }))}
                  >
                    {objectiveSenses.map((sense: string) => (
                      <option key={sense} value={sense} disabled={sense === "max" && !supportsObjectiveSense}>
                        {sense}
                        {sense === "max" && !supportsObjectiveSense ? ` (${t.unavailable})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="param-section">
              <div className="param-section-title">{t.solver}</div>
              <div className="notice compact">{t.currentTarget}: {formatTarget(form)}</div>
              <div className="param-grid">
                <label>
                  {t.axisI}
                  <select disabled={busy} value={form.i_axis} onChange={(e) => setForm((prev) => ({ ...prev, i_axis: Number(e.target.value) }))}>
                    {axisOptions.map((axis) => (
                      <option key={`i-${axis}`} value={axis}>{axis}</option>
                    ))}
                  </select>
                </label>

                <label>
                  {t.axisJ}
                  <select disabled={busy} value={form.j_axis} onChange={(e) => setForm((prev) => ({ ...prev, j_axis: Number(e.target.value) }))}>
                    {axisOptions.map((axis) => (
                      <option key={`j-${axis}`} value={axis}>{axis}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Step k
                  <input disabled={busy} type="number" step="0.01" value={form.step_k} onChange={(e) => setForm((prev) => ({ ...prev, step_k: Number(e.target.value) }))} />
                </label>

                <label>
                  {t.maxIters}
                  <input disabled={busy} type="number" value={form.max_iters} onChange={(e) => setForm((prev) => ({ ...prev, max_iters: Number(e.target.value) }))} />
                </label>

                {(form.algorithm === "v2" || form.algorithm === "v3" || form.algorithm === "v4" || form.algorithm === "v5" || form.algorithm === "v6" || form.algorithm === "v7" || form.algorithm === "v8" || form.algorithm === "v9" || form.algorithm === "v10_test" || form.algorithm === "v11_test") && (
                  <>
                    <label>
                      {t.convergenceWindow}
                      <input
                        disabled={busy}
                        type="number"
                        min={2}
                        step="1"
                        value={form.convergence_window}
                        onChange={(e) => setForm((prev) => ({ ...prev, convergence_window: Number(e.target.value) }))}
                      />
                    </label>

                    <label>
                      {t.convergenceRtolJraw}
                      <input
                        disabled={busy}
                        type="number"
                        step="0.001"
                        value={form.convergence_rtol_jraw}
                        onChange={(e) => setForm((prev) => ({ ...prev, convergence_rtol_jraw: Number(e.target.value) }))}
                      />
                    </label>

                    {(form.algorithm === "v2" || form.algorithm === "v3" || form.algorithm === "v4" || form.algorithm === "v5" || form.algorithm === "v6" || form.algorithm === "v7" || form.algorithm === "v8" || form.algorithm === "v9" || form.algorithm === "v10_test" || form.algorithm === "v11_test") && (
                      <>
                        <label>
                          {t.nsAlphaJ}
                          <input
                            disabled={busy}
                            type="number"
                            step="0.05"
                            value={form.ns_alpha_j}
                            onChange={(e) => setForm((prev) => ({ ...prev, ns_alpha_j: Number(e.target.value) }))}
                          />
                        </label>

                        <label>
                          {t.nsAlphaC}
                          <input
                            disabled={busy}
                            type="number"
                            step="0.05"
                            value={form.ns_alpha_c}
                            onChange={(e) => setForm((prev) => ({ ...prev, ns_alpha_c: Number(e.target.value) }))}
                          />
                        </label>

                        {form.algorithm === "v6" && (
                          <label>
                            {t.hilbertAlphaFactor}
                            <input
                              disabled={busy}
                              type="number"
                              step="1"
                              min="0.01"
                              value={form.hilbert_alpha_factor}
                              onChange={(e) => setForm((prev) => ({ ...prev, hilbert_alpha_factor: Number(e.target.value) }))}
                            />
                          </label>
                        )}
                      </>
                    )}

                    {(form.algorithm === "v4" || form.algorithm === "v6" || form.algorithm === "v7" || form.algorithm === "v8" || form.algorithm === "v9" || form.algorithm === "v10_test" || form.algorithm === "v11_test") && (
                      <>
                        <label>
                          {t.surfaceAreaFactor}
                          <input
                            disabled={busy}
                            type="number"
                            step="0.05"
                            value={form.surface_area_factor}
                            onChange={(e) => setForm((prev) => ({ ...prev, surface_area_factor: Number(e.target.value) }))}
                          />
                        </label>

                        {form.algorithm === "v9" && (
                          <>
                            <label>
                              {t.areaCorrectionGain}
                              <input
                                disabled={busy}
                                type="number"
                                step="0.05"
                                value={form.area_correction_gain}
                                onChange={(e) => setForm((prev) => ({ ...prev, area_correction_gain: Number(e.target.value) }))}
                              />
                            </label>
                            <label>
                              {t.areaGramRelTol}
                              <input
                                disabled={busy}
                                type="number"
                                step="0.0005"
                                value={form.area_gram_rel_tol}
                                onChange={(e) => setForm((prev) => ({ ...prev, area_gram_rel_tol: Number(e.target.value) }))}
                              />
                            </label>
                          </>
                        )}
                      </>
                    )}

                    {(form.algorithm === "v5" || form.algorithm === "v6" || form.algorithm === "v7" || form.algorithm === "v8" || form.algorithm === "v9" || form.algorithm === "v10_test" || form.algorithm === "v11_test") && (
                      <>
                        <label>
                          {t.shiftX}
                          <input
                            disabled={busy}
                            type="number"
                            step="0.1"
                            value={form.shift_x}
                            onChange={(e) => setForm((prev) => ({ ...prev, shift_x: Number(e.target.value) }))}
                          />
                        </label>

                        <label>
                          {t.shiftY}
                          <input
                            disabled={busy}
                            type="number"
                            step="0.1"
                            value={form.shift_y}
                            onChange={(e) => setForm((prev) => ({ ...prev, shift_y: Number(e.target.value) }))}
                          />
                        </label>

                        <label>
                          {t.shiftZ}
                          <input
                            disabled={busy}
                            type="number"
                            step="0.1"
                            value={form.shift_z}
                            onChange={(e) => setForm((prev) => ({ ...prev, shift_z: Number(e.target.value) }))}
                          />
                        </label>
                      </>
                    )}

                    {(form.algorithm === "v3" || form.algorithm === "v4" || form.algorithm === "v5" || form.algorithm === "v7" || form.algorithm === "v8") && (
                      <>
                        <label className="inline-checkbox">
                          <input
                            disabled={busy}
                            type="checkbox"
                            checked={form.final_refine}
                            onChange={(e) => setForm((prev) => ({ ...prev, final_refine: e.target.checked }))}
                          />
                          {t.finalRefine}
                        </label>

                        <label>
                          {t.finalHmaxFactor}
                          <input
                            disabled={busy || !form.final_refine}
                            type="number"
                            step="0.05"
                            value={form.final_hmax_factor}
                            onChange={(e) => setForm((prev) => ({ ...prev, final_hmax_factor: Number(e.target.value) }))}
                          />
                        </label>

                        <label>
                          {t.finalHminRatio}
                          <input
                            disabled={busy || !form.final_refine}
                            type="number"
                            step="0.01"
                            value={form.final_hmin_ratio}
                            onChange={(e) => setForm((prev) => ({ ...prev, final_hmin_ratio: Number(e.target.value) }))}
                          />
                        </label>

                        <label>
                          {t.finalHausdRatio}
                          <input
                            disabled={busy || !form.final_refine}
                            type="number"
                            step="0.1"
                            value={form.final_hausd_ratio}
                            onChange={(e) => setForm((prev) => ({ ...prev, final_hausd_ratio: Number(e.target.value) }))}
                          />
                        </label>

                        <label>
                          {t.finalRmc}
                          <input
                            disabled={busy || !form.final_refine}
                            type="number"
                            step="0.0001"
                            value={form.final_rmc}
                            onChange={(e) => setForm((prev) => ({ ...prev, final_rmc: Number(e.target.value) }))}
                          />
                        </label>

                        <label>
                          {t.smoothSteps}
                          <input
                            disabled={busy || !form.final_refine}
                            type="number"
                            min={1}
                            step="1"
                            value={form.smooth_steps}
                            onChange={(e) => setForm((prev) => ({ ...prev, smooth_steps: Number(e.target.value) }))}
                          />
                        </label>

                        <label>
                          {t.smoothEpsFactor}
                          <input
                            disabled={busy || !form.final_refine}
                            type="number"
                            step="0.05"
                            value={form.smooth_eps_factor}
                            onChange={(e) => setForm((prev) => ({ ...prev, smooth_eps_factor: Number(e.target.value) }))}
                          />
                        </label>

                        <label>
                          {t.smoothIsoShift}
                          <input
                            disabled={busy || !form.final_refine}
                            type="number"
                            step="0.01"
                            value={form.smooth_iso_shift}
                            onChange={(e) => setForm((prev) => ({ ...prev, smooth_iso_shift: Number(e.target.value) }))}
                          />
                        </label>

                        {form.algorithm === "v8" && (
                          <>
                            <label>
                              {t.featureSmoothKappaFactor}
                              <input
                                disabled={busy || !form.final_refine}
                                type="number"
                                step="0.05"
                                value={form.feature_smooth_kappa_factor}
                                onChange={(e) => setForm((prev) => ({ ...prev, feature_smooth_kappa_factor: Number(e.target.value) }))}
                              />
                            </label>

                            <label>
                              {t.featureSmoothMinWeight}
                              <input
                                disabled={busy || !form.final_refine}
                                type="number"
                                min={0}
                                max={1}
                                step="0.01"
                                value={form.feature_smooth_min_weight}
                                onChange={(e) => setForm((prev) => ({ ...prev, feature_smooth_min_weight: Number(e.target.value) }))}
                              />
                            </label>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}

                {form.algorithm === "v1" && (
                  <label>
                    AL penalty
                    <input disabled={busy} type="number" value={form.penalty ?? 100} onChange={(e) => setForm((prev) => ({ ...prev, penalty: Number(e.target.value) }))} />
                  </label>
                )}
              </div>
            </div>

            <div className="param-section">
              <div className="param-section-title">{t.render}</div>
              <div className="param-grid">
                <label>
                  {t.camera}
                  <select value={form.camera_preset} onChange={(e) => setForm((prev) => ({ ...prev, camera_preset: e.target.value as any }))}>
                    {cameraOptions.map((item: string) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label>
                  FPS
                  <input type="number" value={form.fps} onChange={(e) => setForm((prev) => ({ ...prev, fps: Number(e.target.value) }))} />
                </label>

                <label>
                  Width
                  <input type="number" value={form.width} onChange={(e) => setForm((prev) => ({ ...prev, width: Number(e.target.value) }))} />
                </label>

                <label>
                  Height
                  <input type="number" value={form.height} onChange={(e) => setForm((prev) => ({ ...prev, height: Number(e.target.value) }))} />
                </label>

                <label className="field-span-2">
                  Color
                  <input list="color-by-options" value={form.color_by} onChange={(e) => setForm((prev) => ({ ...prev, color_by: e.target.value }))} />
                  <datalist id="color-by-options">
                    <option value="solid" />
                    <option value="Region" />
                    <option value="adjacent_displacement" />
                    <option value="theta" />
                    <option value="dist" />
                    <option value="advect" />
                  </datalist>
                </label>

                <label className="inline-checkbox">
                  <input type="checkbox" checked={form.show_edges} onChange={(e) => setForm((prev) => ({ ...prev, show_edges: e.target.checked }))} />
                  {t.showEdges}
                </label>
              </div>
            </div>

            <div className="param-section">
              <div className="param-section-title">{t.advanced}</div>
              <div className="param-grid">
                <label>
                  hmax
                  <input
                    disabled={busy}
                    type="number"
                    step="0.01"
                    value={form.hmax}
                    onChange={(e) => setForm((prev) => ({ ...prev, hmax: Number(e.target.value) }))}
                  />
                </label>

                <label>
                  hmin_ratio
                  <input
                    disabled={busy}
                    type="number"
                    step="0.01"
                    value={form.hmin_ratio}
                    onChange={(e) => setForm((prev) => ({ ...prev, hmin_ratio: Number(e.target.value) }))}
                  />
                </label>

                <label>
                  hausd_ratio
                  <input
                    disabled={busy}
                    type="number"
                    step="0.01"
                    value={form.hausd_ratio}
                    onChange={(e) => setForm((prev) => ({ ...prev, hausd_ratio: Number(e.target.value) }))}
                  />
                </label>
              </div>
            </div>

            <div className="button-row actions-row">
              <button disabled={busy} onClick={() => void handleStart()}>
                {t.start}
              </button>
              <button disabled={busy} className="secondary" onClick={() => void handlePresetSave()}>
                {t.savePreset}
              </button>
            </div>

            {message && <div className="notice">{message}</div>}
          </div>
        ) : (
        <div className="detail-stack">
          <div className="status-grid">
            <div className="metric">
              <span>{t.metrics.iteration}</span>
              <strong>{activeDetail?.summary?.iteration ?? "-"}</strong>
            </div>
            <div className="metric">
              <span>{t.metrics.objective}</span>
              <strong>{activeDetail?.summary?.objective?.toFixed?.(6) ?? "-"}</strong>
            </div>
            <div className="metric">
              <span>{t.metrics.volume}</span>
              <strong>{activeDetail?.summary?.volume?.toFixed?.(6) ?? "-"}</strong>
            </div>
            <div className="metric">
              <span>{t.metrics.stage}</span>
              <strong>{activeDetail?.summary?.stage ?? "-"}</strong>
            </div>
            <div className="metric">
              <span>{t.metrics.duration}</span>
              <strong>{formatDuration(activeDetail?.summary?.duration_seconds)}</strong>
            </div>
          </div>

          {activeDetail?.diagnostics?.length ? (
            <div className="diagnostics">
              {activeDetail.diagnostics.map((item) => (
                <div key={item.title} className="diagnostic">
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="video-card">
            <div className="video-toolbar">
              <div>
                <h3>{t.animationPreview}</h3>
                <p className="toolbar-subtitle">{t.previewNote}</p>
              </div>
              <div className="button-row">
                <button disabled={busy || !selectedExperimentId} onClick={() => void handleRender(false)}>
                  {t.refreshPreview}
                </button>
                <button disabled={busy || !selectedExperimentId} className="secondary" onClick={() => void handleRender(true)}>
                  {t.renderFinal}
                </button>
              </div>
            </div>

            <div className="camera-strip">
              {cameraOptions.map((item: string) => (
                <button
                  key={item}
                  className={`camera-chip ${form.camera_preset === item ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, camera_preset: item as any }))}
                >
                  {item}
                </button>
              ))}
            </div>

            {activeCameraUrl ? (
              <video key={activeCameraUrl} controls autoPlay muted loop src={activeCameraUrl} />
            ) : (
              <div className="placeholder">{t.noPreview}</div>
            )}
          </div>

          {supportsFinalMesh && (
            <div className="mesh-viewer-card">
              <div className="video-toolbar">
                <div>
                  <h3>{t.finalMeshViewer}</h3>
                  <p className="toolbar-subtitle">
                    {finalMeshData
                      ? `${finalMeshData.point_count} pts · ${finalMeshData.triangle_count} tris${
                          finalMeshData.velocity?.count
                            ? ` · ${finalMeshData.velocity.count} u arrows · step ${finalMeshData.velocity.timestep ?? "latest"}`
                            : ""
                        }`
                      : t.finalMeshPending}
                  </p>
                  {finalMeshData ? (
                    <>
                      <p className="toolbar-subtitle">
                        {t.finalMeshSource}: {finalMeshData.source} · {t.finalMeshSelection}: {finalMeshData.selection_mode ?? "unknown"}
                      </p>
                      <p className="toolbar-subtitle">
                        {finalMeshData.source.endsWith(".postsmooth.mesh") || finalMeshData.source === "Omega.postsmooth.mesh"
                          ? t.finalMeshVerifiedPostSmooth
                          : finalMeshData.source === "Omega.final.mesh"
                            ? t.finalMeshVerifiedFinal
                            : t.finalMeshFallback}
                      </p>
                    </>
                  ) : null}
                </div>
                <div className="button-row">
                  <label>
                    {t.meshToView}
                    <select
                      disabled={!meshOptions.length}
                      value={effectiveMeshName ?? ""}
                      onChange={(event) => setSelectedMeshName(event.target.value || null)}
                    >
                      {meshOptions.map((option) => (
                        <option key={option.name} value={option.name}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="secondary"
                    disabled={!effectiveMeshName || postSmoothBusy}
                    onClick={() => {
                      setShowPostSmoothPanel((prev) => {
                        const next = !prev;
                        if (next) {
                          setPostSmoothForm(buildPostSmoothConfig(activeDetail));
                        }
                        return next;
                      });
                    }}
                  >
                    {showPostSmoothPanel ? t.postSmoothClose : t.postSmoothOpen}
                  </button>
                  {selectedSmoothOption ? (
                    <button
                      className="secondary"
                      disabled={postSmoothBusy}
                      onClick={() => setSelectedMeshName(selectedSmoothOption.name)}
                    >
                      {t.postSmoothResult}
                    </button>
                  ) : null}
                </div>
              </div>

              {selectedSmoothOption ? <div className="notice compact">{t.postSmoothReady}</div> : null}

              {showPostSmoothPanel ? (
                <div className="param-section post-smooth-panel">
                  <div className="param-section-title">{t.postSmoothPanel}</div>
                  <div className="param-grid">
                    <label>
                      <span>{t.finalHmaxFactor}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={postSmoothForm.final_hmax_factor}
                        onChange={(event) =>
                          setPostSmoothForm((prev) => ({
                            ...prev,
                            final_hmax_factor: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{t.finalHminRatio}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={postSmoothForm.final_hmin_ratio}
                        onChange={(event) =>
                          setPostSmoothForm((prev) => ({
                            ...prev,
                            final_hmin_ratio: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{t.finalHausdRatio}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={postSmoothForm.final_hausd_ratio}
                        onChange={(event) =>
                          setPostSmoothForm((prev) => ({
                            ...prev,
                            final_hausd_ratio: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{t.finalRmc}</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={postSmoothForm.final_rmc}
                        onChange={(event) =>
                          setPostSmoothForm((prev) => ({
                            ...prev,
                            final_rmc: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{t.smoothSteps}</span>
                      <input
                        type="number"
                        min={1}
                        step="1"
                        value={postSmoothForm.smooth_steps}
                        onChange={(event) =>
                          setPostSmoothForm((prev) => ({
                            ...prev,
                            smooth_steps: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{t.smoothEpsFactor}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={postSmoothForm.smooth_eps_factor}
                        onChange={(event) =>
                          setPostSmoothForm((prev) => ({
                            ...prev,
                            smooth_eps_factor: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{t.smoothIsoShift}</span>
                      <input
                        type="number"
                        step="0.001"
                        value={postSmoothForm.smooth_iso_shift}
                        onChange={(event) =>
                          setPostSmoothForm((prev) => ({
                            ...prev,
                            smooth_iso_shift: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{t.smoothMode}</span>
                      <select
                        value={postSmoothForm.smooth_mode}
                        onChange={(event) =>
                          setPostSmoothForm((prev) => ({
                            ...prev,
                            smooth_mode: event.target.value as PostSmoothConfig["smooth_mode"]
                          }))
                        }
                      >
                        <option value="global">{t.smoothModeGlobal}</option>
                        <option value="feature">{t.smoothModeFeature}</option>
                      </select>
                    </label>
                    {postSmoothForm.smooth_mode === "feature" ? (
                      <>
                        <label>
                          <span>{t.featureSmoothKappaFactor}</span>
                          <input
                            type="number"
                            step="0.05"
                            value={postSmoothForm.feature_smooth_kappa_factor}
                            onChange={(event) =>
                              setPostSmoothForm((prev) => ({
                                ...prev,
                                feature_smooth_kappa_factor: Number(event.target.value)
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>{t.featureSmoothMinWeight}</span>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step="0.01"
                            value={postSmoothForm.feature_smooth_min_weight}
                            onChange={(event) =>
                              setPostSmoothForm((prev) => ({
                                ...prev,
                                feature_smooth_min_weight: Number(event.target.value)
                              }))
                            }
                          />
                        </label>
                      </>
                    ) : null}
                  </div>
                  <div className="button-row actions-row">
                    <button disabled={!effectiveMeshName || postSmoothBusy} onClick={() => void handleRunPostSmooth()}>
                      {postSmoothBusy ? t.postSmoothRunning : t.postSmoothRun}
                    </button>
                    {selectedSmoothOption ? (
                      <button
                        className="secondary"
                        disabled={postSmoothBusy}
                        onClick={() => setSelectedMeshName(selectedSmoothOption.name)}
                      >
                        {t.postSmoothResult}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {finalMeshData ? (
                <FinalMeshViewer mesh={finalMeshData} />
              ) : (
                <div className="placeholder">{finalMeshError || t.finalMeshPending}</div>
              )}
            </div>
          )}

          <div className="chart-grid">
            <div className="chart-card">
              <h3>{t.objectiveCurve}</h3>
              {objectiveSeries?.rows?.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={objectiveSeries.rows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={objectiveSeries.columns[0]} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey={objectiveSeries.columns[1]} stroke="#1043d9" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="placeholder">{t.noObjective}</div>
              )}
            </div>

            <div className="chart-card">
              <h3>{t.volumeCurve}</h3>
              {volumeSeries?.rows?.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={volumeSeries.rows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={volumeSeries.columns[0]} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey={volumeSeries.columns[1]} stroke="#d95f02" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="placeholder">{t.noVolume}</div>
              )}
            </div>
          </div>

          <div className="log-box">
            <div className="video-toolbar">
              <h3>{t.experimentConfig}</h3>
              <div className="button-row">
                <button
                  className="secondary"
                  disabled={!activeDetail?.config}
                  onClick={handleCreateFromConfig}
                >
                  {t.createFromConfig}
                </button>
              </div>
            </div>
            <pre>{activeDetail ? JSON.stringify(activeDetail.config, null, 2) : t.noLog}</pre>
          </div>

          <div className="log-box">
            <h3>{t.latestLog}</h3>
            <pre>{activeDetail?.log_tail || t.noLog}</pre>
          </div>
          {message && <div className="notice">{message}</div>}
        </div>
        )}
      </main>
    </div>
  );
}
