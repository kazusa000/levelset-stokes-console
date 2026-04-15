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
import type { ExperimentDetail, ExperimentSummary, JobConfig } from "./types";

type Locale = "zh" | "en";

const defaultConfig: JobConfig = {
  dimension: "3d",
  algorithm: "original",
  initial_shape: "sphere",
  objective_mode: "K",
  objective_sense: "min",
  i_axis: 1,
  j_axis: 1,
  max_iters: 20,
  step_k: 0.1,
  hmax: 0.2,
  hmin_ratio: 0.1,
  hausd_ratio: 0.1,
  penalty: 100,
  penalty_v: 5000,
  penalty_nu: 5000,
  conservative_preset: true,
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
    model: "模型设置",
    solver: "求解设置",
    render: "动画设置",
    advanced: "高级参数",
    preset: "预设模板",
    choosePreset: "选择预设",
    dimension: "维度",
    algorithm: "算法",
    initialShape: "初始形状",
    objectiveMode: "目标模式",
    objectiveSense: "优化方向",
    unavailable: "暂不可用",
    experimental: "实验性",
    shapePreview: "初始形状预览",
    shapeStable: "标准形状，可直接用于当前优化流程",
    shapeExperimental: "实验性形状，可能更容易数值不稳",
    currentTarget: "当前目标",
    axisI: "i 轴",
    axisJ: "j 轴",
    maxIters: "最大迭代",
    conservative: "保守参数",
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
    presetName: "预设名称",
    savedPreset: (name: string) => `已保存预设：${name}`,
    refreshedPreview: (view: string) => `已刷新 ${view} 角度预览`,
    renderedFinal: (view: string) => `已生成 ${view} 角度最终动画`,
    deleteConfirm: (id: string) => `再次点击“确认删除”以删除实验 ${id}`,
    metrics: { iteration: "Iteration", objective: "Objective", volume: "Volume", stage: "Stage" }
  },
  en: {
    subtitle: "Local experiment console",
    model: "Model",
    solver: "Solver",
    render: "Rendering",
    advanced: "Advanced",
    preset: "Preset",
    choosePreset: "Choose preset",
    dimension: "Dimension",
    algorithm: "Algorithm",
    initialShape: "Initial shape",
    objectiveMode: "Objective mode",
    objectiveSense: "Objective sense",
    unavailable: "unavailable",
    experimental: "Experimental",
    shapePreview: "Initial shape preview",
    shapeStable: "Standard shape, suitable for the current optimization workflow",
    shapeExperimental: "Experimental shape, more likely to be numerically unstable",
    currentTarget: "Current target",
    axisI: "i axis",
    axisJ: "j axis",
    maxIters: "Max iterations",
    conservative: "Conservative preset",
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
    torus: `<circle cx="80" cy="60" r="31" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/><circle cx="80" cy="60" r="14" fill="#eef4fb" stroke="#4b6ea9" stroke-width="3"/>`,
    triaxial: `<path d="M44,66c0,-23 18,-36 40,-36c19,0 33,9 33,28c0,20 -15,32 -39,32c-21,0 -34,-9 -34,-24z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    circle: `<circle cx="80" cy="60" r="28" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`,
    annulus: `<circle cx="80" cy="60" r="30" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/><circle cx="80" cy="60" r="13" fill="#eef4fb" stroke="#4b6ea9" stroke-width="3"/>`,
    eccentric_ring: `<ellipse cx="80" cy="60" rx="32" ry="26" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/><ellipse cx="92" cy="58" rx="16" ry="11" fill="#eef4fb" stroke="#4b6ea9" stroke-width="3"/>`,
    double_hole: `<ellipse cx="80" cy="60" rx="36" ry="28" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/><ellipse cx="67" cy="60" rx="11" ry="8" fill="#eef4fb" stroke="#4b6ea9" stroke-width="3"/><ellipse cx="93" cy="60" rx="11" ry="8" fill="#eef4fb" stroke="#4b6ea9" stroke-width="3"/>`
  };

  const fallback = dimension === "2d"
    ? `<circle cx="80" cy="60" r="28" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`
    : `<path d="M46,66c0,-22 18,-34 36,-34c14,0 23,5 29,14c5,8 12,9 12,20c0,16 -15,27 -36,27c-26,0 -41,-11 -41,-27z" fill="url(#g)" stroke="#4b6ea9" stroke-width="3"/>`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
      ${base}
      ${silhouettes[shape] ?? fallback}
    </svg>
  `;
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
  if (config.algorithm === "ns") {
    return {
      ...config,
      penalty: undefined,
      penalty_v: undefined,
      penalty_nu: undefined
    };
  }
  if (config.algorithm === "rv") {
    return {
      ...config,
      penalty: undefined,
      penalty_v: config.penalty_v ?? 5000,
      penalty_nu: config.penalty_nu ?? 5000
    };
  }
  return {
    ...config,
    penalty: config.penalty ?? 100,
    penalty_v: undefined,
    penalty_nu: undefined
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

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const stored = window.localStorage.getItem("levelset-console-locale");
    return stored === "en" ? "en" : "zh";
  });
  const { data: configData } = usePolling<any>("/api/config", 10000);
  const { data: currentData, error: currentError, setData: setCurrentData } = usePolling<{ current: ExperimentDetail | null }>(
    "/api/jobs/current",
    2500
  );
  const { data: experimentsData, error: experimentsError, setData: setExperimentsData } = usePolling<
    ExperimentSummary[]
  >("/api/experiments", 5000);

  const [form, setForm] = useState<JobConfig>(defaultConfig);
  const [busy, setBusy] = useState(false);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [experimentDetail, setExperimentDetail] = useState<ExperimentDetail | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const t = ui[locale];

  const currentExperiment = currentData?.current ?? null;
  const locked = Boolean(currentExperiment);

  const shapes = useMemo(() => configData?.shapes?.[form.dimension] ?? [], [configData, form.dimension]);
  const presets = configData?.presets ?? [];
  const cameraOptions = configData?.camera_presets?.[form.dimension] ?? ["default"];
  const axisOptions = form.dimension === "2d" ? [0, 1] : [0, 1, 2];
  const objectiveModes = configData?.objective_modes ?? [
    { key: "K", enabled: true },
    { key: "C", enabled: true },
    { key: "Q", enabled: false }
  ];
  const objectiveSenses = configData?.objective_senses ?? ["min", "max"];
  const supportsC = form.algorithm === "original" || form.algorithm === "ns";
  const supportsObjectiveSense = form.algorithm === "original" || form.algorithm === "ns";
  const selectedShape = shapes.find((shape: any) => shape.key === form.initial_shape) ?? null;
  const shapePreview = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(shapePreviewSvg(form.dimension, form.initial_shape))}`,
    [form.dimension, form.initial_shape]
  );

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
    if (form.dimension === "2d" && form.camera_preset !== "default") {
      setForm((prev) => ({ ...prev, camera_preset: "default" }));
    }
  }, [form.dimension, form.camera_preset]);

  useEffect(() => {
    if (form.objective_mode === "C" && !supportsC) {
      setForm((prev) => ({ ...prev, objective_mode: "K" }));
    }
  }, [form.objective_mode, supportsC]);

  useEffect(() => {
    if (form.objective_sense === "max" && !supportsObjectiveSense) {
      setForm((prev) => ({ ...prev, objective_sense: "min" }));
    }
  }, [form.objective_sense, supportsObjectiveSense]);

  useEffect(() => {
    if (currentExperiment) {
      setSelectedExperimentId(currentExperiment.id);
      setExperimentDetail(currentExperiment);
      return;
    }

    if (!selectedExperimentId && experimentsData?.length) {
      void loadExperiment(experimentsData[0].id);
    }
  }, [currentExperiment, experimentsData, selectedExperimentId]);

  const activeDetail = currentExperiment ?? experimentDetail;
  const objectiveSeries = activeDetail?.series?.["obj.txt"] ?? activeDetail?.series?.["obj_rv.txt"];
  const volumeSeries = activeDetail?.series?.["vol.txt"] ?? activeDetail?.series?.["vol_rv.txt"];
  const activeCameraUrl =
    activeDetail?.preview_urls?.[form.camera_preset] ?? activeDetail?.final_urls?.[form.camera_preset] ?? null;

  const loadExperiment = async (id: string) => {
    const response = await fetch(`/api/experiments/${id}`);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const payload = (await response.json()) as ExperimentDetail;
    setSelectedExperimentId(id);
    setExperimentDetail(payload);
  };

  const handleStart = async () => {
    try {
      setBusy(true);
      setMessage("");
      const payload = patchDefaults(form);
      const response = await postJson<{ current: ExperimentDetail | null }>("/api/jobs", payload);
      if (response.current) {
        setSelectedExperimentId(response.current.id);
        setExperimentDetail(response.current);
      }
      const experiments = await fetch("/api/experiments").then((res) => res.json());
      setExperimentsData(experiments);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.startFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    try {
      setBusy(true);
      await postJson("/api/jobs/current/stop");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.stopFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleRender = async (final: boolean, experimentId?: string) => {
    try {
      setBusy(true);
      const url = experimentId
        ? `/api/experiments/${experimentId}/render`
        : "/api/jobs/current/render";
      const result = await postJson<ExperimentDetail>(url, {
        camera_preset: form.camera_preset,
        final
      });
      if (experimentId) {
        setExperimentDetail(result);
      } else {
        setCurrentData({ current: result });
        setExperimentDetail(result);
      }
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
        setExperimentDetail(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.deleteFailed);
    } finally {
      setBusy(false);
    }
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
      <aside className="panel sidebar">
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
              <select
                disabled={locked}
                value={form.dimension}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    dimension: e.target.value as JobConfig["dimension"],
                    initial_shape: e.target.value === "2d" ? "circle" : "sphere"
                  }))
                }
              >
                <option value="3d">3D</option>
                <option value="2d">2D</option>
              </select>
            </label>

            <label>
              {t.algorithm}
              <select
                disabled={locked}
                value={form.algorithm}
                onChange={(e) =>
                  setForm((prev) => patchDefaults({ ...prev, algorithm: e.target.value as JobConfig["algorithm"] }))
                }
              >
                <option value="original">original</option>
                <option value="ns">NS</option>
                <option value="rv">RV</option>
              </select>
            </label>

            <label className="field-span-2">
              {t.initialShape}
              <select
                disabled={locked}
                value={form.initial_shape}
                onChange={(e) => setForm((prev) => ({ ...prev, initial_shape: e.target.value }))}
              >
                {shapes.map((shape: any) => (
                  <option key={shape.key} value={shape.key}>
                    {shape.label}
                    {shape.experimental ? ` (${t.experimental})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="shape-preview-card field-span-2">
              <img className="shape-preview-image" src={shapePreview} alt={`${form.initial_shape} preview`} />
              <div className="shape-preview-meta">
                <strong>{selectedShape?.label ?? form.initial_shape}</strong>
                <span>{form.dimension.toUpperCase()} {t.shapePreview}</span>
                <span>{selectedShape?.experimental ? t.shapeExperimental : t.shapeStable}</span>
              </div>
            </div>

            <label>
              {t.objectiveMode}
              <select
                disabled={locked}
                value={form.objective_mode}
                onChange={(e) => setForm((prev) => ({ ...prev, objective_mode: e.target.value as JobConfig["objective_mode"] }))}
              >
                {objectiveModes.map((mode: any) => {
                  const supported =
                    mode.key === "K" ? true :
                    mode.key === "C" ? supportsC :
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
                disabled={locked}
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
          <div className="notice compact">{t.currentTarget}: {form.objective_mode}_{form.i_axis}{form.j_axis}</div>
          <div className="param-grid">
            <label>
              {t.axisI}
              <select
                disabled={locked}
                value={form.i_axis}
                onChange={(e) => setForm((prev) => ({ ...prev, i_axis: Number(e.target.value) }))}
              >
                {axisOptions.map((axis) => (
                  <option key={`i-${axis}`} value={axis}>
                    {axis}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t.axisJ}
              <select
                disabled={locked}
                value={form.j_axis}
                onChange={(e) => setForm((prev) => ({ ...prev, j_axis: Number(e.target.value) }))}
              >
                {axisOptions.map((axis) => (
                  <option key={`j-${axis}`} value={axis}>
                    {axis}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Step k
              <input
                disabled={locked}
                type="number"
                step="0.01"
                value={form.step_k}
                onChange={(e) => setForm((prev) => ({ ...prev, step_k: Number(e.target.value) }))}
              />
            </label>

            <label>
              {t.maxIters}
              <input
                disabled={locked}
                type="number"
                value={form.max_iters}
                onChange={(e) => setForm((prev) => ({ ...prev, max_iters: Number(e.target.value) }))}
              />
            </label>

            {form.algorithm === "original" && (
              <label>
                AL penalty
                <input
                  disabled={locked}
                  type="number"
                  value={form.penalty ?? 100}
                  onChange={(e) => setForm((prev) => ({ ...prev, penalty: Number(e.target.value) }))}
                />
              </label>
            )}

            {form.algorithm === "rv" && (
              <>
                <label>
                  penalty V
                  <input
                    disabled={locked}
                    type="number"
                    value={form.penalty_v ?? 5000}
                    onChange={(e) => setForm((prev) => ({ ...prev, penalty_v: Number(e.target.value) }))}
                  />
                </label>
                <label>
                  penalty Nu
                  <input
                    disabled={locked}
                    type="number"
                    value={form.penalty_nu ?? 5000}
                    onChange={(e) => setForm((prev) => ({ ...prev, penalty_nu: Number(e.target.value) }))}
                  />
                </label>
              </>
            )}

            <label className="inline-checkbox">
              <input
                type="checkbox"
                checked={form.conservative_preset}
                onChange={(e) => setForm((prev) => ({ ...prev, conservative_preset: e.target.checked }))}
              />
              {t.conservative}
            </label>
          </div>
        </div>

        <div className="param-section">
          <div className="param-section-title">{t.render}</div>
          <div className="param-grid">
            <label>
              {t.camera}
              <select
                value={form.camera_preset}
                onChange={(e) => setForm((prev) => ({ ...prev, camera_preset: e.target.value as any }))}
              >
                {cameraOptions.map((item: string) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
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
              <input value={form.color_by} onChange={(e) => setForm((prev) => ({ ...prev, color_by: e.target.value }))} />
            </label>

            <label className="inline-checkbox">
              <input
                type="checkbox"
                checked={form.show_edges}
                onChange={(e) => setForm((prev) => ({ ...prev, show_edges: e.target.checked }))}
              />
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
                disabled={locked}
                type="number"
                step="0.01"
                value={form.hmax}
                onChange={(e) => setForm((prev) => ({ ...prev, hmax: Number(e.target.value) }))}
              />
            </label>

            <label>
              hmin_ratio
              <input
                disabled={locked}
                type="number"
                step="0.01"
                value={form.hmin_ratio}
                onChange={(e) => setForm((prev) => ({ ...prev, hmin_ratio: Number(e.target.value) }))}
              />
            </label>

            <label>
              hausd_ratio
              <input
                disabled={locked}
                type="number"
                step="0.01"
                value={form.hausd_ratio}
                onChange={(e) => setForm((prev) => ({ ...prev, hausd_ratio: Number(e.target.value) }))}
              />
            </label>
          </div>
        </div>

        <div className="button-row actions-row">
          <button disabled={busy || locked} onClick={() => void handleStart()}>
            {t.start}
          </button>
          <button disabled={busy || !locked} className="danger" onClick={() => void handleStop()}>
            {t.stop}
          </button>
          <button disabled={busy} className="secondary" onClick={() => void handlePresetSave()}>
            {t.savePreset}
          </button>
        </div>

        {message && <div className="notice">{message}</div>}
      </aside>

      <main className="panel workspace">
        <div className="section-header">
          <h2>{t.runningPreview}</h2>
          <p>{currentExperiment ? t.running : t.idle}</p>
        </div>

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

        <div className="video-card">
          <div className="video-toolbar">
            <div>
              <h3>动画预览</h3>
              <p className="toolbar-subtitle">{t.previewNote}</p>
            </div>
            <div className="button-row">
              <button disabled={busy || !currentExperiment} onClick={() => void handleRender(false)}>
                {t.refreshPreview}
              </button>
              <button
                disabled={busy || !(currentExperiment || selectedExperimentId)}
                className="secondary"
                onClick={() => void handleRender(true, selectedExperimentId ?? undefined)}
              >
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
      </main>

      <aside className="panel sidebar rightbar">
        <div className="section-header">
          <h2>{t.logsHistory}</h2>
          <p>{currentError || experimentsError || ""}</p>
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

        <div className="log-box">
          <h3>{t.latestLog}</h3>
          <pre>{activeDetail?.log_tail || t.noLog}</pre>
        </div>

        <div className="history-box">
          <h3>{t.experiments}</h3>
          <div className="history-list">
            {experimentsData?.map((experiment) => (
              <div
                key={experiment.id}
                className={`history-item ${selectedExperimentId === experiment.id ? "active" : ""}`}
              >
                <button
                  className="history-main"
                  onClick={() => {
                    setPendingDeleteId(null);
                    void loadExperiment(experiment.id);
                  }}
                >
                  <strong>{experiment.id}</strong>
                  <span>
                    {experiment.config.dimension.toUpperCase()} / {experiment.config.algorithm} / {experiment.config.initial_shape}
                  </span>
                  <span>J={experiment.summary.objective ?? "-"}</span>
                </button>
                <button
                  className="history-delete danger"
                  disabled={busy || currentExperiment?.id === experiment.id}
                  onClick={() => void handleDeleteExperiment(experiment.id)}
                >
                  {pendingDeleteId === experiment.id ? t.confirmDelete : t.delete}
                </button>
              </div>
            ))}
          </div>
        </div>

      </aside>
    </div>
  );
}
