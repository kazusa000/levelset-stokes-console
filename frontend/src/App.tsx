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
import type { ExperimentDetail, ExperimentSummary, FinalMeshData, JobConfig } from "./types";

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
  final_refine: true,
  final_hmax_factor: 1.0,
  final_hmin_ratio: 0.1,
  final_hausd_ratio: 3.0,
  final_rmc: 1e-4,
  smooth_steps: 1,
  smooth_eps_factor: 0.05,
  smooth_iso_shift: 0.0,
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
    convergenceWindow: "收敛窗口",
    convergenceRtolJraw: "Jraw 收敛阈值",
    nsAlphaJ: "NS alphaJ 系数",
    nsAlphaC: "NS alphaC 系数",
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
    finalMeshSource: "来源",
    finalMeshSelection: "提取方式",
    experimentConfig: "实验参数",
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
    metrics: { iteration: "Iteration", objective: "Objective", volume: "Volume", stage: "Stage" }
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
    convergenceWindow: "Convergence window",
    convergenceRtolJraw: "Jraw convergence rtol",
    nsAlphaJ: "NS alphaJ factor",
    nsAlphaC: "NS alphaC factor",
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
    finalMeshSource: "Source",
    finalMeshSelection: "Selection",
    experimentConfig: "Experiment Config",
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
    metrics: { iteration: "Iteration", objective: "Objective", volume: "Volume", stage: "Stage" }
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
  if (config.algorithm === "v3") {
    return {
      ...config,
      step_k: 0.2,
      convergence_window: 5,
      convergence_rtol_jraw: 5e-2,
      ns_alpha_j: 0.5,
      ns_alpha_c: 0.5,
      final_refine: true,
      final_hmax_factor: 0.1,
      final_hmin_ratio: 0.1,
      final_hausd_ratio: 3.0,
      final_rmc: 1e-4,
      smooth_steps: 1,
      smooth_eps_factor: 1.0,
      smooth_iso_shift: 0.0,
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
  const [busy, setBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [shapePreviewFailed, setShapePreviewFailed] = useState(false);
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
  const { data: detailData, setData: setDetailData } = usePolling<ExperimentDetail>(detailUrl, 2500, Boolean(selectedExperimentId));

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
    form.algorithm === "v3";
  const supportsQ =
    form.algorithm === "v1" ||
    form.algorithm === "v2" ||
    form.algorithm === "v3";
  const supportsObjectiveSense =
    form.algorithm === "v1" ||
    form.algorithm === "v2" ||
    form.algorithm === "v3";
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
  const finalMeshUrl =
    activeDetail?.config.dimension === "3d" &&
    (
      activeDetail?.config.algorithm === "v2" ||
      activeDetail?.config.algorithm === "v3"
    )
      ? activeDetail.final_mesh_url ?? null
      : null;
  const { data: finalMeshData, error: finalMeshError } = usePolling<FinalMeshData>(
    finalMeshUrl ?? "",
    5000,
    Boolean(finalMeshUrl)
  );

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
    setForm({ ...defaultConfig, ...preset.config });
  };

  const handlePresetSave = async () => {
    const name = window.prompt(t.presetName);
    if (!name) {
      return;
    }
    await postJson("/api/presets", { name, config: form });
    setMessage(t.savedPreset(name));
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
                    onChange={(e) =>
                      setForm((prev) => patchDefaults({ ...prev, algorithm: e.target.value as JobConfig["algorithm"] }))
                    }
                  >
                    <option value="v1">3Dv1</option>
                    <option value="v2">3Dv2</option>
                    <option value="v3">3Dv3</option>
                  </select>
                </label>

                <label className="field-span-2">
                  {t.initialShape}
                  <select
                    disabled={busy}
                    value={form.initial_shape}
                    onChange={(e) => setForm((prev) => ({ ...prev, initial_shape: e.target.value }))}
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

                {(form.algorithm === "v2" || form.algorithm === "v3") && (
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

                    {(form.algorithm === "v2" || form.algorithm === "v3") && (
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
                      </>
                    )}

                    {form.algorithm === "v3" && (
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

          {activeDetail?.config.dimension === "3d" &&
            (activeDetail?.config.algorithm === "v2" ||
              activeDetail?.config.algorithm === "v3") && (
            <div className="mesh-viewer-card">
              <div className="video-toolbar">
                <div>
                  <h3>{t.finalMeshViewer}</h3>
                  <p className="toolbar-subtitle">
                    {finalMeshData
                      ? `${finalMeshData.point_count} pts · ${finalMeshData.triangle_count} tris`
                      : t.finalMeshPending}
                  </p>
                  {finalMeshData ? (
                    <>
                      <p className="toolbar-subtitle">
                        {t.finalMeshSource}: {finalMeshData.source} · {t.finalMeshSelection}: {finalMeshData.selection_mode ?? "unknown"}
                      </p>
                      <p className="toolbar-subtitle">
                        {finalMeshData.source === "Omega.final.mesh" ? t.finalMeshVerifiedFinal : t.finalMeshFallback}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>

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
            <h3>{t.experimentConfig}</h3>
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
