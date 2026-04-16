from __future__ import annotations

import json
import os
import re
import signal
import shutil
import subprocess
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


APP_DIR = Path(__file__).resolve().parent
CONSOLE_DIR = APP_DIR.parent
FRONTEND_DIST = CONSOLE_DIR / "frontend" / "dist"


def env_path(name: str, default: Path) -> Path:
    value = os.environ.get(name)
    return Path(value).expanduser().resolve() if value else default.resolve()


DEFAULT_STAGE_DIR = CONSOLE_DIR.parent
STAGE_DIR = env_path("LEVELSET_STAGE_DIR", DEFAULT_STAGE_DIR)
RODIN_DIR = env_path("LEVELSET_RODIN_DIR", STAGE_DIR / "rodin")
BUILD_DIR = env_path("LEVELSET_BUILD_DIR", RODIN_DIR / "build")
EXPORT_SCRIPT = env_path("LEVELSET_EXPORT_SCRIPT", CONSOLE_DIR / "scripts" / "export_obstacle_animation.sh")
EXPERIMENTS_DIR = env_path("LEVELSET_EXPERIMENTS_DIR", CONSOLE_DIR / "runs" / "experiments")
USER_PRESETS_FILE = EXPERIMENTS_DIR / "user-presets.json"

PETSC_DIR = os.environ.get("PETSC_DIR") or os.environ.get("LEVELSET_PETSC_DIR", "/usr/local/ff-petsc/r")
JOBS = os.environ.get("JOBS") or os.environ.get("LEVELSET_JOBS", "4")

EXPERIMENTS_DIR.mkdir(parents=True, exist_ok=True)


TARGETS: dict[tuple[str, str], dict[str, Any]] = {
    ("3d", "original"): {
        "target": "PETSc_LevelSetStokes3DObstacle",
        "xdmf": "LevelSetStokes3DObstacle.xdmf",
        "history": ["obj.txt", "vol.txt", "al.txt"],
    },
    ("3d", "ns"): {
        "target": "PETSc_LevelSetStokes3DObstacle_NS",
        "xdmf": "LevelSetStokes3DObstacle_NS.xdmf",
        "history": ["obj.txt", "vol.txt", "ns.txt"],
    },
    ("3d", "rv"): {
        "target": "PETSc_LevelSetStokes3DObstacle_RV",
        "xdmf": "LevelSetStokes3DObstacle_RV.xdmf",
        "history": ["obj_rv.txt", "vol_rv.txt", "al_rv.txt"],
    },
    ("2d", "original"): {
        "target": "PETSc_LevelSetStokes2DObstacle",
        "xdmf": "LevelSetStokes2DObstacle.xdmf",
        "history": ["obj.txt", "vol.txt", "al.txt"],
    },
    ("2d", "ns"): {
        "target": "PETSc_LevelSetStokes2DObstacle_NS",
        "xdmf": "LevelSetStokes2DObstacle_NS.xdmf",
        "history": ["obj.txt", "vol.txt", "ns.txt"],
    },
    ("2d", "rv"): {
        "target": "PETSc_LevelSetStokes2DObstacle_RV",
        "xdmf": "LevelSetStokes2DObstacle_RV.xdmf",
        "history": ["obj_rv.txt", "vol_rv.txt", "al_rv.txt"],
    },
}

SHAPES: dict[str, list[dict[str, Any]]] = {
    "3d": [
        {
            "key": "sphere",
            "label": "Sphere",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/sphere_init_aligned.mesh"),
            "experimental": False,
        },
        {
            "key": "sphere_bump",
            "label": "Sphere Bump",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/sphere_bump_init.mesh"),
            "experimental": False,
        },
        {
            "key": "prolate",
            "label": "Prolate",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/prolate_init.mesh"),
            "experimental": False,
        },
        {
            "key": "oblate",
            "label": "Oblate",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/oblate_init.mesh"),
            "experimental": False,
        },
        {
            "key": "capsule",
            "label": "Capsule",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/capsule_init.mesh"),
            "experimental": False,
        },
        {
            "key": "double_sphere",
            "label": "Double Sphere",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/double_sphere_init.mesh"),
            "experimental": True,
        },
        {
            "key": "peanut",
            "label": "Peanut",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/peanut_init.mesh"),
            "experimental": False,
        },
        {
            "key": "three_lobe",
            "label": "Three Lobe",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/three_lobe_init.mesh"),
            "experimental": True,
        },
        {
            "key": "rounded_three_lobe",
            "label": "Rounded Three Lobe",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/rounded_three_lobe_init.mesh"),
            "experimental": False,
        },
        {
            "key": "rounded_four_lobe",
            "label": "Rounded Four Lobe",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/rounded_four_lobe_init.mesh"),
            "experimental": False,
        },
        {
            "key": "seven_lobe_star",
            "label": "Seven Lobe Star",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/seven_lobe_star_init.mesh"),
            "experimental": True,
        },
        {
            "key": "dumbbell",
            "label": "Dumbbell",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/dumbbell_init.mesh"),
            "experimental": False,
        },
        {
            "key": "torus",
            "label": "Torus",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/torus_init.mesh"),
            "experimental": True,
        },
    ],
    "2d": [
        {
            "key": "circle",
            "label": "Circle",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/2dshapes/circle_init_2d.mesh"),
            "experimental": False,
        },
        {
            "key": "annulus",
            "label": "Annulus",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/2dshapes/annulus_init_2d.mesh"),
            "experimental": True,
        },
        {
            "key": "eccentric_ring",
            "label": "Eccentric Ring",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/2dshapes/eccentric_ring_init_2d.mesh"),
            "experimental": True,
        },
        {
            "key": "double_hole",
            "label": "Double Hole",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/2dshapes/double_hole_init_2d.mesh"),
            "experimental": True,
        },
    ],
}

DEFAULT_PRESETS = [
    {
        "name": "3D-original-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "original",
            "initial_shape": "sphere",
            "objective_mode": "K",
            "i_axis": 1,
            "j_axis": 1,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": 0.2,
            "hmin_ratio": 0.1,
            "hausd_ratio": 0.1,
            "penalty": 100.0,
            "camera_preset": "isometric",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
    {
        "name": "3D-ns-prolate",
        "config": {
            "dimension": "3d",
            "algorithm": "ns",
            "initial_shape": "prolate",
            "objective_mode": "K",
            "i_axis": 1,
            "j_axis": 1,
            "max_iters": 10,
            "step_k": 0.1,
            "hmax": 0.2,
            "hmin_ratio": 0.1,
            "hausd_ratio": 0.1,
            "camera_preset": "isometric",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
    {
        "name": "2D-original-circle",
        "config": {
            "dimension": "2d",
            "algorithm": "original",
            "initial_shape": "circle",
            "objective_mode": "K",
            "i_axis": 1,
            "j_axis": 1,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": 0.2,
            "hmin_ratio": 0.1,
            "hausd_ratio": 0.1,
            "penalty": 100.0,
            "camera_preset": "default",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
]

DIAGNOSTICS = [
    {
        "needle": "No seed vertices found for the interface",
        "title": "界面消失",
        "message": "障碍物在优化过程中几乎消失，距离重建找不到界面种子。通常需要更强的体积约束、更少的迭代数，或更保守的步长。",
    },
    {
        "needle": "Point is not contained in the finite element space mesh",
        "title": "网格/场定位失败",
        "message": "当前界面或初始形状过于激进，边界积分点无法稳定映射到有限元网格。优先尝试更平滑的形状或 original 算法。",
    },
    {
        "needle": "Failed to open",
        "title": "输入网格不存在",
        "message": "选择的 mesh 路径无法读取。请检查初始形状是否存在，或者自定义 mesh 路径是否正确。",
    },
    {
        "needle": "pvpython not found in PATH",
        "title": "ParaView 未安装",
        "message": "动画导出需要 pvpython。请安装 paraview，或先只运行求解再单独处理可视化。",
    },
    {
        "needle": "ffmpeg not found in PATH",
        "title": "ffmpeg 未安装",
        "message": "动画导出为 mp4 需要 ffmpeg。安装 ffmpeg 后可重新生成预览或最终动画。",
    },
]


class JobConfig(BaseModel):
    dimension: Literal["2d", "3d"]
    algorithm: Literal["original", "ns", "rv"]
    initial_shape: str
    objective_mode: Literal["K", "C", "Q"] = "K"
    objective_sense: Literal["min", "max"] = "min"
    mesh_path: str | None = None
    i_axis: int = 1
    j_axis: int = 1
    max_iters: int = Field(default=20, ge=1, le=500)
    step_k: float = Field(default=0.1, gt=0)
    hmax: float = Field(default=0.2, gt=0)
    hmin_ratio: float = Field(default=0.1, gt=0)
    hausd_ratio: float = Field(default=0.1, gt=0)
    penalty: float | None = None
    penalty_v: float | None = None
    penalty_nu: float | None = None
    conservative_preset: bool = True
    camera_preset: Literal["default", "front", "side", "top", "isometric"] = "default"
    fps: int = Field(default=5, ge=1, le=60)
    width: int = Field(default=960, ge=320, le=3840)
    height: int = Field(default=540, ge=240, le=2160)
    color_by: str = "solid"
    show_edges: bool = False


class SavePresetRequest(BaseModel):
    name: str
    config: JobConfig


class RenderRequest(BaseModel):
    camera_preset: Literal["default", "front", "side", "top", "isometric"] = "default"
    final: bool = False


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text())
    except Exception:
        return fallback


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))


ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE_RE.sub("", text)


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip()).strip("-").lower()
    return value or "experiment"


def resolve_shape(config: JobConfig) -> dict[str, Any]:
    if config.mesh_path:
        return {"key": "custom", "mesh": config.mesh_path, "experimental": True, "label": "Custom Mesh"}
    for shape in SHAPES[config.dimension]:
        if shape["key"] == config.initial_shape:
            return shape
    raise HTTPException(status_code=400, detail=f"Unknown shape: {config.initial_shape}")


def resolve_target(config: JobConfig) -> dict[str, Any]:
    info = TARGETS.get((config.dimension, config.algorithm))
    if not info:
        raise HTTPException(status_code=400, detail="Unsupported dimension/algorithm combination.")
    return info


def supports_objective_mode(config: JobConfig) -> bool:
    if config.objective_mode == "K":
        return True
    if config.objective_mode == "C":
        return config.algorithm == "original" or config.algorithm == "ns"
    if config.objective_mode == "Q":
        return config.dimension == "3d" and (config.algorithm == "original" or config.algorithm == "ns")
    return False


def supports_objective_sense(config: JobConfig) -> bool:
    return config.algorithm == "original" or config.algorithm == "ns"


def build_env(config: JobConfig, mesh_path: str) -> dict[str, str]:
    env = os.environ.copy()
    env["MESH"] = mesh_path
    env["OBJECTIVE_MODE"] = str(config.objective_mode)
    env["OBJECTIVE_SENSE"] = str(config.objective_sense)
    env["IAXIS"] = str(config.i_axis)
    env["JAXIS"] = str(config.j_axis)
    env["MAX_ITERS"] = str(config.max_iters)
    env["STEP_K"] = str(config.step_k)
    env["HMAX"] = str(config.hmax)
    env["HMIN_RATIO"] = str(config.hmin_ratio)
    env["HAUSD_RATIO"] = str(config.hausd_ratio)
    if config.penalty is not None:
        env["AL_PENALTY"] = str(config.penalty)
    if config.penalty_v is not None:
        env["PENALTY_V"] = str(config.penalty_v)
    if config.penalty_nu is not None:
        env["PENALTY_NU"] = str(config.penalty_nu)
    return env


def parse_series_file(path: Path, default_columns: list[str]) -> dict[str, Any]:
    if not path.exists():
        return {"columns": default_columns, "rows": []}

    rows: list[dict[str, float]] = []
    for row_index, line in enumerate(path.read_text().splitlines()):
        parts = line.strip().split()
        if not parts:
            continue
        values = [float(p) for p in parts]
        if default_columns and default_columns[0] == "iter" and len(values) == len(default_columns) - 1:
            values = [float(row_index)] + values
            columns = default_columns
        elif len(default_columns) == len(values):
            columns = default_columns
        else:
            columns = [f"c{i}" for i in range(len(values))]
        rows.append({columns[i]: values[i] for i in range(len(values))})
    return {"columns": columns if rows else default_columns, "rows": rows}


def series_layout(config: dict[str, Any], history_name: str) -> list[str]:
    algorithm = config.get("algorithm")
    if history_name == "obj.txt":
        if algorithm == "ns":
            return ["iter", "objective"]
        return ["iter", "objective", "objective_aug"]
    if history_name == "vol.txt":
        return ["iter", "volume", "violation"]
    if history_name == "al.txt":
        return ["lambda", "penalty"]
    if history_name == "ns.txt":
        return ["iter", "alpha_j", "alpha_c", "proj_coeff", "range_coeff", "max_xi_j", "max_xi_c"]
    if history_name == "obj_rv.txt":
        return ["iter", "objective", "objective_aug"]
    if history_name == "vol_rv.txt":
        return ["iter", "volume", "area", "nu"]
    if history_name == "al_rv.txt":
        return ["lambda_v", "penalty_v", "lambda_nu", "penalty_nu"]
    return ["c0", "c1"]


def tail_lines(path: Path, limit: int = 200) -> str:
    if not path.exists():
        return ""
    lines = path.read_text(errors="replace").splitlines()
    return strip_ansi("\n".join(lines[-limit:]))


def extract_diagnostics(log_text: str) -> list[dict[str, str]]:
    found = []
    for item in DIAGNOSTICS:
        if item["needle"] in log_text:
            found.append({"title": item["title"], "message": item["message"]})
    return found


def extract_runtime_summary(log_text: str, series: dict[str, Any]) -> dict[str, Any]:
    iteration_matches = re.findall(r"Iteration:\s*(\d+)", log_text)
    objective_matches = re.findall(r"Objective(?: raw)?:\s*([^\s,]+)", log_text)
    stage_matches = re.findall(r"Info:\s+\|\s+([^\n]+)", log_text)
    summary = {
        "iteration": int(iteration_matches[-1]) if iteration_matches else None,
        "objective": float(objective_matches[-1]) if objective_matches and objective_matches[-1] not in {"nan", "-nan"} else None,
        "stage": stage_matches[-1] if stage_matches else None,
        "volume": None,
    }
    volume_series = series.get("vol.txt") or series.get("vol_rv.txt")
    if volume_series and volume_series["rows"]:
        last_row = volume_series["rows"][-1]
        summary["volume"] = last_row.get("volume") or last_row.get("c1")
    return summary


def experiment_artifact_url(experiment_id: str, relative_path: str | None) -> str | None:
    if not relative_path:
        return None
    full_path = EXPERIMENTS_DIR / experiment_id / relative_path
    suffix = f"?t={int(full_path.stat().st_mtime)}" if full_path.exists() else ""
    return f"/artifacts/{experiment_id}/{relative_path}{suffix}"


def list_user_presets() -> list[dict[str, Any]]:
    return read_json(USER_PRESETS_FILE, [])


def read_experiment(experiment_dir: Path) -> dict[str, Any]:
    config = read_json(experiment_dir / "config.json", {})
    meta = read_json(experiment_dir / "meta.json", {})
    target_info = TARGETS.get((config.get("dimension"), config.get("algorithm")))
    history_names = target_info["history"] if target_info else []
    history_dir = experiment_dir
    series = {
        name: parse_series_file(history_dir / name, series_layout(config, name))
        for name in history_names
    }
    log_text = tail_lines(experiment_dir / "run.log")
    summary = extract_runtime_summary(log_text, series)

    previews = {}
    out_dir = experiment_dir / "out"
    for file in sorted(out_dir.glob("preview-*.mp4")):
        key = file.stem.replace("preview-", "")
        previews[key] = experiment_artifact_url(experiment_dir.name, f"out/{file.name}")

    finals = {}
    for file in sorted(out_dir.glob("final-*.mp4")):
        key = file.stem.replace("final-", "")
        finals[key] = experiment_artifact_url(experiment_dir.name, f"out/{file.name}")

    if not finals and (out_dir / "obstacle.mp4").exists():
        finals["default"] = experiment_artifact_url(experiment_dir.name, "out/obstacle.mp4")

    return {
        "id": experiment_dir.name,
        "config": config,
        "meta": meta,
        "summary": summary,
        "series": series,
        "log_tail": log_text,
        "diagnostics": extract_diagnostics(log_text),
        "preview_urls": previews,
        "final_urls": finals,
        "xdmf_url": experiment_artifact_url(experiment_dir.name, f"out/{target_info['xdmf']}") if target_info else None,
    }


def experiment_list() -> list[dict[str, Any]]:
    items = []
    for path in sorted(EXPERIMENTS_DIR.glob("*"), reverse=True):
        if path.is_dir() and (path / "config.json").exists():
            data = read_experiment(path)
            items.append(
                {
                    "id": data["id"],
                    "config": data["config"],
                    "meta": data["meta"],
                    "summary": data["summary"],
                    "diagnostics": data["diagnostics"],
                }
            )
    return items


def ensure_configured() -> None:
    if (BUILD_DIR / "CMakeCache.txt").exists():
        return
    subprocess.run(
        [
            "cmake",
            "-S",
            str(RODIN_DIR),
            "-B",
            str(BUILD_DIR),
            "-DRODIN_BUILD_EXAMPLES=ON",
            "-DRODIN_USE_PETSC=ON",
            "-DRODIN_USE_MPI=ON",
            f"-DPETSc_DIR={PETSC_DIR}",
        ],
        check=True,
        cwd=STAGE_DIR,
    )


def build_target(target: str) -> None:
    ensure_configured()
    subprocess.run(
        ["cmake", "--build", str(BUILD_DIR), "--target", target, "-j", JOBS],
        check=True,
        cwd=STAGE_DIR,
    )


def animation_env(input_path: Path, output_path: Path, camera: str, config: dict[str, Any], preview: bool) -> dict[str, str]:
    env = os.environ.copy()
    env["INPUT"] = str(input_path)
    env["OUTPUT"] = str(output_path)
    env["CAMERA_PRESET"] = camera
    env["FPS"] = str(min(int(config.get("fps", 5)), 5) if preview else int(config.get("fps", 5)))
    env["WIDTH"] = str(min(int(config.get("width", 960)), 960) if preview else int(config.get("width", 960)))
    env["HEIGHT"] = str(min(int(config.get("height", 540)), 540) if preview else int(config.get("height", 540)))
    env["COLOR_BY"] = config.get("color_by", "solid")
    env["SHOW_EDGES"] = "1" if config.get("show_edges") else "0"
    return env


@dataclass
class RunningJob:
    experiment_id: str
    experiment_dir: Path
    config: dict[str, Any]
    target_info: dict[str, Any]
    process: subprocess.Popen[str]
    log_handle: Any
    started_at: str
    preview_thread: threading.Thread | None = None
    final_thread: threading.Thread | None = None
    preview_lock: threading.Lock = field(default_factory=threading.Lock)
    last_preview_request: float = 0.0
    last_preview_iteration: int = -1


class JobManager:
    def __init__(self) -> None:
        self.jobs: dict[str, RunningJob] = {}
        self.lock = threading.RLock()

    def _meta_path(self, experiment_dir: Path) -> Path:
        return experiment_dir / "meta.json"

    def _write_meta(self, experiment_dir: Path, payload: dict[str, Any]) -> None:
        current = read_json(self._meta_path(experiment_dir), {})
        current.update(payload)
        write_json(self._meta_path(experiment_dir), current)

    def start(self, config: JobConfig) -> dict[str, Any]:
        with self.lock:
            shape = resolve_shape(config)
            target_info = resolve_target(config)
            target = target_info["target"]
            build_target(target)

            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            experiment_id = slugify(f"{timestamp}-{config.dimension}-{config.algorithm}-{shape['key']}")
            experiment_dir = EXPERIMENTS_DIR / experiment_id
            experiment_dir.mkdir(parents=True, exist_ok=True)
            (experiment_dir / "out").mkdir(exist_ok=True)

            config_payload = config.model_dump()
            config_payload["mesh_path"] = shape["mesh"]
            config_payload["initial_shape_label"] = shape["label"]
            write_json(experiment_dir / "config.json", config_payload)
            self._write_meta(
                experiment_dir,
                {
                    "status": "running",
                    "created_at": now_iso(),
                    "started_at": now_iso(),
                    "target": target,
                },
            )

            log_handle = open(experiment_dir / "run.log", "w", encoding="utf-8")
            executable = BUILD_DIR / "examples/PETSc/LevelSetStokes" / target
            env = build_env(config, shape["mesh"])
            process = subprocess.Popen(
                [str(executable)],
                cwd=experiment_dir,
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                text=True,
                env=env,
            )

            job = RunningJob(
                experiment_id=experiment_id,
                experiment_dir=experiment_dir,
                config=config_payload,
                target_info=target_info,
                process=process,
                log_handle=log_handle,
                started_at=now_iso(),
            )
            self.jobs[experiment_id] = job
            return read_experiment(experiment_dir)

    def stop(self, experiment_id: str) -> dict[str, Any]:
        with self.lock:
            job = self.jobs.get(experiment_id)
            if not job or job.process.poll() is not None:
                raise HTTPException(status_code=404, detail="No running job.")
            job.process.terminate()
            try:
                job.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                job.process.kill()
                job.process.wait(timeout=5)
            self._finalize_job(experiment_id, "stopped")
            return {"status": "stopped", "id": experiment_id}

    def _render_animation(self, experiment_dir: Path, config: dict[str, Any], target_info: dict[str, Any], camera: str, preview: bool) -> None:
        xdmf_path = experiment_dir / "out" / target_info["xdmf"]
        if not xdmf_path.exists():
            return
        output_name = f"{'preview' if preview else 'final'}-{camera}.mp4"
        output_path = experiment_dir / "out" / output_name
        subprocess.run(
            [str(EXPORT_SCRIPT)],
            check=False,
            cwd=STAGE_DIR,
            env=animation_env(xdmf_path, output_path, camera, config, preview=preview),
        )

    def _maybe_start_preview(self, job: RunningJob, iteration: int | None) -> None:
        xdmf_path = job.experiment_dir / "out" / job.target_info["xdmf"]
        if not xdmf_path.exists():
            return
        if iteration is None:
            return
        if iteration <= job.last_preview_iteration:
            return
        if time.time() - job.last_preview_request < 5:
            return
        with job.preview_lock:
            if job.preview_thread and job.preview_thread.is_alive():
                return
            job.last_preview_request = time.time()
            job.last_preview_iteration = iteration
            job.preview_thread = threading.Thread(
                target=self._render_animation,
                args=(job.experiment_dir, job.config, job.target_info, job.config.get("camera_preset", "default"), True),
                daemon=True,
            )
            job.preview_thread.start()

    def _finalize_job(self, experiment_id: str, status: str) -> None:
        job = self.jobs.get(experiment_id)
        if not job:
            return
        if not job.log_handle.closed:
            job.log_handle.flush()
            job.log_handle.close()
        self._write_meta(
            job.experiment_dir,
            {
                "status": status,
                "finished_at": now_iso(),
                "returncode": job.process.poll(),
            },
        )
        if status == "finished":
            thread = threading.Thread(
                target=self._render_animation,
                args=(job.experiment_dir, job.config, job.target_info, job.config.get("camera_preset", "default"), False),
                daemon=True,
            )
            thread.start()
            job.final_thread = thread
        self.jobs.pop(experiment_id, None)

    def status(self, focus_experiment_id: str | None = None) -> dict[str, Any]:
        with self.lock:
            running: list[dict[str, Any]] = []
            for experiment_id, job in list(self.jobs.items()):
                code = job.process.poll()
                if code is not None:
                    status = "finished" if code == 0 else "failed"
                    self._finalize_job(experiment_id, status)
                    continue

                data = read_experiment(job.experiment_dir)
                if focus_experiment_id == experiment_id:
                    self._maybe_start_preview(job, data["summary"].get("iteration"))
                data["meta"]["status"] = "running"
                running.append(data)

            running.sort(key=lambda item: item["meta"].get("started_at") or item["meta"].get("created_at") or "", reverse=True)
            return {"running": running}

    def is_running(self, experiment_id: str) -> bool:
        with self.lock:
            job = self.jobs.get(experiment_id)
            return bool(job and job.process.poll() is None)

    def render(self, experiment_id: str, camera: str, final: bool) -> dict[str, Any]:
        experiment_dir = EXPERIMENTS_DIR / experiment_id
        if not experiment_dir.exists():
            raise HTTPException(status_code=404, detail="Experiment not found.")
        data = read_experiment(experiment_dir)
        target_info = resolve_target(JobConfig(**data["config"]))
        self._render_animation(experiment_dir, data["config"], target_info, camera, preview=not final)
        return read_experiment(experiment_dir)


manager = JobManager()

app = FastAPI(title="LevelSetStokes Console")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/config")
def api_config() -> dict[str, Any]:
    return {
        "shapes": SHAPES,
        "objective_modes": [
            {"key": "K", "enabled": True},
            {"key": "C", "enabled": True},
            {"key": "Q", "enabled": True},
        ],
        "objective_senses": ["min", "max"],
        "camera_presets": {
            "3d": ["default", "front", "side", "top", "isometric"],
            "2d": ["default"],
        },
        "presets": DEFAULT_PRESETS + list_user_presets(),
    }


@app.post("/api/jobs")
def api_start_job(config: JobConfig) -> dict[str, Any]:
    if not supports_objective_mode(config):
        raise HTTPException(
            status_code=400,
            detail="当前组合暂不支持该目标模式。现阶段 C 支持 original 和 NS；Q 仅支持 3D original 和 3D NS。",
        )
    if config.objective_sense == "max" and not supports_objective_sense(config):
        raise HTTPException(
            status_code=400,
            detail="当前组合暂不支持 max 模式。现阶段 min/max 支持 original 和 NS。",
        )
    return manager.start(config)


@app.get("/api/jobs")
def api_jobs(focus: str | None = None) -> dict[str, Any]:
    return manager.status(focus_experiment_id=focus)


@app.post("/api/jobs/{experiment_id}/stop")
def api_stop_job(experiment_id: str) -> dict[str, Any]:
    return manager.stop(experiment_id)


@app.post("/api/jobs/{experiment_id}/render")
def api_render_running(experiment_id: str, request: RenderRequest) -> dict[str, Any]:
    if not manager.is_running(experiment_id):
        raise HTTPException(status_code=404, detail="Job is not running.")
    return manager.render(experiment_id, request.camera_preset, request.final)


@app.get("/api/experiments")
def api_experiments() -> list[dict[str, Any]]:
    return experiment_list()


@app.get("/api/experiments/{experiment_id}")
def api_experiment_detail(experiment_id: str) -> dict[str, Any]:
    path = EXPERIMENTS_DIR / experiment_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Experiment not found.")
    return read_experiment(path)


@app.delete("/api/experiments/{experiment_id}")
def api_delete_experiment(experiment_id: str) -> dict[str, Any]:
    path = EXPERIMENTS_DIR / experiment_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Experiment not found.")
    if manager.is_running(experiment_id):
        raise HTTPException(status_code=409, detail="Cannot delete a running experiment.")
    shutil.rmtree(path)
    return {"ok": True}


@app.post("/api/experiments/{experiment_id}/render")
def api_experiment_render(experiment_id: str, request: RenderRequest) -> dict[str, Any]:
    return manager.render(experiment_id, request.camera_preset, request.final)


@app.get("/api/presets")
def api_presets() -> list[dict[str, Any]]:
    return DEFAULT_PRESETS + list_user_presets()


@app.post("/api/presets")
def api_save_preset(request: SavePresetRequest) -> dict[str, Any]:
    presets = list_user_presets()
    presets = [p for p in presets if p.get("name") != request.name]
    presets.insert(0, {"name": request.name, "config": request.config.model_dump()})
    write_json(USER_PRESETS_FILE, presets)
    return {"ok": True}


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    def root_index() -> FileResponse:
        return FileResponse(FRONTEND_DIST / "index.html")

app.mount("/artifacts", StaticFiles(directory=str(EXPERIMENTS_DIR)), name="artifacts")
