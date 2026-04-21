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

DEFAULT_HMAX = 0.4
DEFAULT_HMIN_RATIO = 0.1
DEFAULT_HAUSD_RATIO = 0.1
PHASE_OBSTACLE = 2
PHASE_FLUID = 3

ALGORITHM_ALIASES: dict[str, str] = {
    "v1": "v1",
    "v2": "v2",
    "v3": "v3",
    "original": "v1",
    "ns": "v2",
    "test_3DNS_phi_smooth1": "v3",
}

TARGETS: dict[tuple[str, str], dict[str, Any]] = {
    ("3d", "v1"): {
        "target": "PETSc_3Dv1",
        "xdmf": "3Dv1.xdmf",
        "history": ["obj.txt", "vol.txt", "al.txt"],
    },
    ("3d", "v2"): {
        "target": "PETSc_3Dv2",
        "xdmf": "3Dv2.xdmf",
        "history": ["obj.txt", "vol.txt", "ns.txt"],
    },
    ("3d", "v3"): {
        "target": "PETSc_3Dv3",
        "xdmf": "3Dv3.xdmf",
        "history": ["obj.txt", "vol.txt", "ns.txt"],
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
}

DEFAULT_PRESETS = [
    {
        "name": "3D-3Dv1-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "v1",
            "initial_shape": "sphere",
            "objective_mode": "K",
            "i_axis": 1,
            "j_axis": 1,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
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
        "name": "3D-3Dv2-prolate",
        "config": {
            "dimension": "3d",
            "algorithm": "v2",
            "initial_shape": "prolate",
            "objective_mode": "K",
            "i_axis": 1,
            "j_axis": 1,
            "max_iters": 10,
            "step_k": 0.1,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
            "camera_preset": "isometric",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
    {
        "name": "3D-3Dv3-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "v3",
            "initial_shape": "sphere",
            "objective_mode": "K",
            "i_axis": 1,
            "j_axis": 1,
            "max_iters": 20,
            "step_k": 0.2,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
            "convergence_window": 5,
            "convergence_rtol_jraw": 5e-2,
            "ns_alpha_j": 0.5,
            "ns_alpha_c": 0.5,
            "final_refine": True,
            "final_hmax_factor": 0.1,
            "final_hmin_ratio": 0.1,
            "final_hausd_ratio": 3.0,
            "final_rmc": 1e-4,
            "smooth_steps": 1,
            "smooth_eps_factor": 1.0,
            "smooth_iso_shift": 0.0,
            "camera_preset": "isometric",
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
        "message": "当前界面或初始形状过于激进，边界积分点无法稳定映射到有限元网格。优先尝试更平滑的形状或 3Dv1。",
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
    dimension: Literal["3d"]
    algorithm: Literal["v1", "v2", "v3"]
    initial_shape: str
    objective_mode: Literal["K", "C", "Q"] = "K"
    objective_sense: Literal["min", "max"] = "min"
    mesh_path: str | None = None
    i_axis: int = 1
    j_axis: int = 1
    max_iters: int = Field(default=20, ge=1, le=500)
    step_k: float = Field(default=0.1, gt=0)
    hmax: float = Field(default=DEFAULT_HMAX, gt=0)
    hmin_ratio: float = Field(default=DEFAULT_HMIN_RATIO, gt=0)
    hausd_ratio: float = Field(default=DEFAULT_HAUSD_RATIO, gt=0)
    convergence_window: int = Field(default=5, ge=2, le=100)
    convergence_rtol_jraw: float = Field(default=5e-3, gt=0)
    ns_alpha_j: float = Field(default=0.5, gt=0)
    ns_alpha_c: float = Field(default=0.5, gt=0)
    final_refine: bool = True
    final_hmax_factor: float = Field(default=1.0, gt=0)
    final_hmin_ratio: float = Field(default=0.1, gt=0)
    final_hausd_ratio: float = Field(default=3.0, gt=0)
    final_rmc: float = Field(default=1e-4, gt=0)
    smooth_steps: int = Field(default=1, ge=1, le=50)
    smooth_eps_factor: float = Field(default=0.05, gt=0)
    smooth_iso_shift: float = 0.0
    penalty: float | None = None
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


class FavoriteRequest(BaseModel):
    favorite: bool


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


def normalize_config_dict(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(data)
    normalized["dimension"] = "3d"
    algorithm = str(normalized.get("algorithm", "v1"))
    normalized["algorithm"] = ALGORITHM_ALIASES.get(algorithm, algorithm)
    return normalized


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
        return config.algorithm in {"v1", "v2", "v3"}
    if config.objective_mode == "Q":
        return config.algorithm in {"v1", "v2", "v3"}
    return False


def supports_objective_sense(config: JobConfig) -> bool:
    return config.algorithm in {"v1", "v2", "v3"}


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
    if config.algorithm in {"v2", "v3"}:
        env["CONVERGENCE_WINDOW"] = str(config.convergence_window)
        env["CONVERGENCE_RTOL_JRAW"] = str(config.convergence_rtol_jraw)
    if config.algorithm in {"v2", "v3"}:
        env["NS_ALPHA_J"] = str(config.ns_alpha_j)
        env["NS_ALPHA_C"] = str(config.ns_alpha_c)
    if config.algorithm == "v3":
        env["FINAL_REFINE"] = "1" if config.final_refine else "0"
        env["FINAL_HMAX_FACTOR"] = str(config.final_hmax_factor)
        env["FINAL_HMIN_RATIO"] = str(config.final_hmin_ratio)
        env["FINAL_HAUSD_RATIO"] = str(config.final_hausd_ratio)
        env["FINAL_RMC"] = str(config.final_rmc)
        env["SMOOTH_STEPS"] = str(config.smooth_steps)
        env["SMOOTH_EPS_FACTOR"] = str(config.smooth_eps_factor)
        env["SMOOTH_ISO_SHIFT"] = str(config.smooth_iso_shift)
    if config.algorithm == "v1" and config.penalty is not None:
        env["AL_PENALTY"] = str(config.penalty)
    return env


def used_config_payload(config: JobConfig, resolved_mesh_path: str, initial_shape_label: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "dimension": config.dimension,
        "algorithm": config.algorithm,
        "initial_shape": config.initial_shape,
        "initial_shape_label": initial_shape_label,
        "objective_mode": config.objective_mode,
        "objective_sense": config.objective_sense,
        "mesh_path": resolved_mesh_path,
        "i_axis": config.i_axis,
        "j_axis": config.j_axis,
        "max_iters": config.max_iters,
        "step_k": config.step_k,
        "hmax": config.hmax,
        "hmin_ratio": config.hmin_ratio,
        "hausd_ratio": config.hausd_ratio,
        "camera_preset": config.camera_preset,
        "fps": config.fps,
        "width": config.width,
        "height": config.height,
        "color_by": config.color_by,
        "show_edges": config.show_edges,
    }

    if config.algorithm in {"v2", "v3"}:
        payload["convergence_window"] = config.convergence_window
        payload["convergence_rtol_jraw"] = config.convergence_rtol_jraw

    if config.algorithm in {"v2", "v3"}:
        payload["ns_alpha_j"] = config.ns_alpha_j
        payload["ns_alpha_c"] = config.ns_alpha_c

    if config.algorithm == "v3":
        payload["final_refine"] = config.final_refine
        payload["final_hmax_factor"] = config.final_hmax_factor
        payload["final_hmin_ratio"] = config.final_hmin_ratio
        payload["final_hausd_ratio"] = config.final_hausd_ratio
        payload["final_rmc"] = config.final_rmc
        payload["smooth_steps"] = config.smooth_steps
        payload["smooth_eps_factor"] = config.smooth_eps_factor
        payload["smooth_iso_shift"] = config.smooth_iso_shift

    if config.algorithm == "v1" and config.penalty is not None:
        payload["penalty"] = config.penalty

    return payload


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
    algorithm = ALGORITHM_ALIASES.get(str(config.get("algorithm", "v1")), str(config.get("algorithm", "v1")))
    if history_name == "obj.txt":
        if algorithm in {"v2", "v3"}:
            return ["iter", "objective"]
        return ["iter", "objective", "objective_aug"]
    if history_name == "obj_raw.txt":
        return ["iter", "objective_raw"]
    if history_name == "vol.txt":
        return ["iter", "volume", "violation"]
    if history_name == "al.txt":
        return ["lambda", "penalty"]
    if history_name == "ns.txt":
        return ["iter", "alpha_j", "alpha_c", "proj_coeff", "range_coeff", "max_xi_j", "max_xi_c"]
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
    volume_series = series.get("vol.txt")
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


OMEGA_ITERATION_RE = re.compile(r"Omega\.(\d+)\.mesh$")


def find_final_mesh_path(experiment_dir: Path) -> Path | None:
    out_dir = experiment_dir / "out"
    final_path = out_dir / "Omega.final.mesh"
    if final_path.exists():
        return final_path

    numbered: list[tuple[int, Path]] = []
    for path in out_dir.glob("Omega.*.mesh"):
        match = OMEGA_ITERATION_RE.fullmatch(path.name)
        if match:
            numbered.append((int(match.group(1)), path))

    if not numbered:
        return None
    numbered.sort(key=lambda item: item[0])
    return numbered[-1][1]


def parse_medit_surface_polydata(mesh_path: Path, preferred_refs: set[int] | None = None) -> dict[str, Any]:
    preferred = preferred_refs or {13}
    lines = [
        line.strip()
        for line in mesh_path.read_text(errors="replace").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]

    vertices: list[tuple[float, float, float]] = []
    triangles: list[tuple[int, int, int, int]] = []
    tetrahedra: list[tuple[int, int, int, int, int]] = []

    i = 0
    while i < len(lines):
        token = lines[i]
        if token == "Vertices":
            count = int(lines[i + 1])
            for row in lines[i + 2 : i + 2 + count]:
                parts = row.split()
                if len(parts) < 3:
                    raise ValueError(f"Malformed vertex row in {mesh_path.name}: {row}")
                vertices.append((float(parts[0]), float(parts[1]), float(parts[2])))
            i += 2 + count
            continue
        if token == "Triangles":
            count = int(lines[i + 1])
            for row in lines[i + 2 : i + 2 + count]:
                parts = row.split()
                if len(parts) < 4:
                    raise ValueError(f"Malformed triangle row in {mesh_path.name}: {row}")
                triangles.append((int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3])))
            i += 2 + count
            continue
        if token == "Tetrahedra":
            count = int(lines[i + 1])
            for row in lines[i + 2 : i + 2 + count]:
                parts = row.split()
                if len(parts) < 5:
                    raise ValueError(f"Malformed tetrahedra row in {mesh_path.name}: {row}")
                tetrahedra.append(
                    (int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3]), int(parts[4]))
                )
            i += 2 + count
            continue
        i += 1

    if not vertices:
        raise ValueError(f"No vertices found in {mesh_path.name}")
    if not triangles and not tetrahedra:
        raise ValueError(f"No triangles found in {mesh_path.name}")

    selected_faces: list[tuple[int, int, int]]
    selection_mode = "triangle-ref"

    # Prefer the true obstacle-fluid interface when tetrahedra are available.
    if tetrahedra:
        face_refs: dict[tuple[int, int, int], set[int]] = {}
        for a, b, c, d, ref in tetrahedra:
            for face in ((a, b, c), (a, b, d), (a, c, d), (b, c, d)):
                key = tuple(sorted(face))
                refs = face_refs.setdefault(key, set())
                refs.add(ref)

        interface_faces = [
            face
            for face, refs in face_refs.items()
            if PHASE_OBSTACLE in refs and PHASE_FLUID in refs
        ]
        if interface_faces:
            selected_faces = interface_faces
            selection_mode = "tet-interface"
        else:
            selected = [tri for tri in triangles if tri[3] in preferred]
            if selected:
                selected_faces = [(a, b, c) for a, b, c, _ref in selected]
            else:
                selected_faces = [(a, b, c) for a, b, c, _ref in triangles]
                selection_mode = "triangle-all"
    else:
        selected = [tri for tri in triangles if tri[3] in preferred]
        if selected:
            selected_faces = [(a, b, c) for a, b, c, _ref in selected]
        else:
            selected_faces = [(a, b, c) for a, b, c, _ref in triangles]
            selection_mode = "triangle-all"

    index_map: dict[int, int] = {}
    points: list[float] = []
    polys: list[int] = []

    for a, b, c in selected_faces:
        local = []
        for old_index in (a, b, c):
            if old_index < 1 or old_index > len(vertices):
                raise ValueError(f"Triangle index out of range in {mesh_path.name}: {old_index}")
            if old_index not in index_map:
                index_map[old_index] = len(index_map)
                x, y, z = vertices[old_index - 1]
                points.extend((x, y, z))
            local.append(index_map[old_index])
        polys.extend((3, local[0], local[1], local[2]))

    return {
        "source": mesh_path.name,
        "triangle_count": len(selected_faces),
        "point_count": len(index_map),
        "selection_mode": selection_mode,
        "used_reference_filter": selection_mode == "triangle-ref",
        "points": points,
        "polys": polys,
    }


def list_user_presets() -> list[dict[str, Any]]:
    presets = read_json(USER_PRESETS_FILE, [])
    normalized: list[dict[str, Any]] = []
    for item in presets:
        if isinstance(item, dict) and isinstance(item.get("config"), dict):
            normalized.append({**item, "config": normalize_config_dict(item["config"])})
    return normalized


def read_experiment(experiment_dir: Path) -> dict[str, Any]:
    raw_config = read_json(experiment_dir / "config.json", {})
    config = normalize_config_dict(raw_config) if raw_config else {}
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

    final_mesh_path = find_final_mesh_path(experiment_dir)
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
        "final_mesh_url": f"/api/experiments/{experiment_dir.name}/final-mesh" if final_mesh_path else None,
    }


def experiment_list() -> list[dict[str, Any]]:
    items = []
    for path in sorted(EXPERIMENTS_DIR.glob("*"), reverse=True):
        if path.is_dir() and (path / "config.json").exists():
            data = read_experiment(path)
            if data["config"].get("dimension") != "3d":
                continue
            items.append(
                {
                    "id": data["id"],
                    "config": data["config"],
                    "meta": data["meta"],
                    "summary": data["summary"],
                    "diagnostics": data["diagnostics"],
                }
            )
    items.sort(key=lambda item: 0 if item["meta"].get("favorite") else 1)
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

            config_payload = used_config_payload(config, shape["mesh"], shape["label"])
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
        target_info = resolve_target(JobConfig(**normalize_config_dict(data["config"])))
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
        },
        "presets": DEFAULT_PRESETS + list_user_presets(),
    }


@app.post("/api/jobs")
def api_start_job(config: JobConfig) -> dict[str, Any]:
    if not supports_objective_mode(config):
        raise HTTPException(
            status_code=400,
            detail="当前组合暂不支持该目标模式。现阶段 C/Q 仅支持 v1、v2、v3。",
        )
    if config.objective_sense == "max" and not supports_objective_sense(config):
        raise HTTPException(
            status_code=400,
            detail="当前组合暂不支持 max 模式。现阶段 min/max 仅支持 v1、v2、v3。",
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


@app.get("/api/experiments/{experiment_id}/final-mesh")
def api_experiment_final_mesh(experiment_id: str) -> dict[str, Any]:
    path = EXPERIMENTS_DIR / experiment_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Experiment not found.")
    mesh_path = find_final_mesh_path(path)
    if not mesh_path:
        raise HTTPException(status_code=404, detail="Final mesh not found.")
    try:
        return parse_medit_surface_polydata(mesh_path)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.delete("/api/experiments/{experiment_id}")
def api_delete_experiment(experiment_id: str) -> dict[str, Any]:
    path = EXPERIMENTS_DIR / experiment_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Experiment not found.")
    if manager.is_running(experiment_id):
        raise HTTPException(status_code=409, detail="Cannot delete a running experiment.")
    shutil.rmtree(path)
    return {"ok": True}


@app.post("/api/experiments/{experiment_id}/favorite")
def api_experiment_favorite(experiment_id: str, request: FavoriteRequest) -> dict[str, Any]:
    path = EXPERIMENTS_DIR / experiment_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Experiment not found.")
    meta = read_json(path / "meta.json", {})
    meta["favorite"] = request.favorite
    write_json(path / "meta.json", meta)
    return read_experiment(path)


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
