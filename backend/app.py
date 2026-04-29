from __future__ import annotations

import json
import math
import os
import re
import signal
import shutil
import subprocess
import threading
import time
import xml.etree.ElementTree as ET
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
    "v4": "v4",
    "v5": "v5",
    "v6": "v6",
    "v7": "v7",
    "v8": "v8",
    "v9": "v9",
    "v10_test": "v10_test",
    "v11_test": "v11_test",
    "v4_test": "v4",
    "v5_test": "v5",
    "v8_test": "v8",
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
    ("3d", "v4"): {
        "target": "PETSc_3Dv4_test",
        "xdmf": "3Dv4.xdmf",
        "xdmf_aliases": ["3Dv4_test.xdmf"],
        "history": ["obj.txt", "vol.txt", "ns.txt"],
    },
    ("3d", "v5"): {
        "target": "PETSc_3Dv5_test",
        "xdmf": "3Dv5.xdmf",
        "xdmf_aliases": ["3Dv5_test.xdmf"],
        "history": ["obj.txt", "vol.txt", "ns.txt", "centroid.txt"],
    },
    ("3d", "v6"): {
        "target": "PETSc_3Dv6",
        "xdmf": "3Dv6.xdmf",
        "history": ["obj.txt", "vol.txt", "ns.txt", "centroid.txt"],
    },
    ("3d", "v7"): {
        "target": "PETSc_3Dv7_test",
        "xdmf": "3Dv7.xdmf",
        "history": ["obj.txt", "vol.txt", "ns.txt", "centroid.txt"],
    },
    ("3d", "v8"): {
        "target": "PETSc_3Dv8_test",
        "xdmf": "3Dv8.xdmf",
        "history": ["obj.txt", "vol.txt", "ns.txt", "centroid.txt"],
    },
    ("3d", "v9"): {
        "target": "PETSc_3Dv9",
        "xdmf": "3Dv9.xdmf",
        "history": ["obj.txt", "vol.txt", "ns.txt", "centroid.txt"],
    },
    ("3d", "v10_test"): {
        "target": "PETSc_3Dv10_test",
        "xdmf": "3Dv10_test.xdmf",
        "history": ["obj.txt", "obj_before.txt", "vol.txt", "ns.txt", "centroid.txt"],
    },
    ("3d", "v11_test"): {
        "target": "PETSc_3Dv11_test",
        "xdmf": "3Dv11_test.xdmf",
        "history": ["obj.txt", "obj_before.txt", "vol.txt", "ns.txt", "centroid.txt"],
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
            "key": "sphere_fine",
            "label": "Sphere Fine",
            "mesh": str(RODIN_DIR / "examples/PETSc/LevelSetStokes/3dshapes/sphere_fine_init.mesh"),
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
            "convergence_rtol_jraw": 5e-3,
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
    {
        "name": "3D-3Dv4-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "v4",
            "initial_shape": "sphere",
            "objective_mode": "K",
            "objective_sense": "min",
            "i_axis": 1,
            "j_axis": 1,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
            "convergence_window": 5,
            "convergence_rtol_jraw": 5e-3,
            "ns_alpha_j": 0.5,
            "ns_alpha_c": 0.5,
            "surface_area_factor": 1.05,
            "camera_preset": "isometric",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
    {
        "name": "3D-3Dv5-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "v5",
            "initial_shape": "sphere",
            "objective_mode": "C",
            "objective_sense": "min",
            "i_axis": 0,
            "j_axis": 0,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
            "convergence_window": 5,
            "convergence_rtol_jraw": 5e-3,
            "ns_alpha_j": 0.5,
            "ns_alpha_c": 0.5,
            "shift_x": 0.0,
            "shift_y": 0.0,
            "shift_z": 0.0,
            "camera_preset": "isometric",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
    {
        "name": "3D-3Dv6-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "v6",
            "initial_shape": "sphere",
            "objective_mode": "C",
            "objective_sense": "min",
            "i_axis": 0,
            "j_axis": 0,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
            "convergence_window": 5,
            "convergence_rtol_jraw": 5e-3,
            "ns_alpha_j": 0.5,
            "ns_alpha_c": 0.5,
            "hilbert_alpha_factor": 16.0,
            "surface_area_factor": 1.05,
            "shift_x": 0.0,
            "shift_y": 0.0,
            "shift_z": 0.0,
            "camera_preset": "isometric",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
    {
        "name": "3D-3Dv7-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "v7",
            "initial_shape": "sphere",
            "objective_mode": "C",
            "objective_sense": "min",
            "i_axis": 0,
            "j_axis": 0,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
            "convergence_window": 5,
            "convergence_rtol_jraw": 5e-3,
            "ns_alpha_j": 0.5,
            "ns_alpha_c": 0.5,
            "surface_area_factor": 1.05,
            "shift_x": 0.0,
            "shift_y": 0.0,
            "shift_z": 0.0,
            "final_refine": True,
            "final_hmax_factor": 0.1,
            "final_hmin_ratio": 0.1,
            "final_hausd_ratio": 3.0,
            "final_rmc": 1e-4,
            "smooth_steps": 1,
            "smooth_eps_factor": 0.1,
            "smooth_iso_shift": 0.0,
            "camera_preset": "isometric",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
    {
        "name": "3D-3Dv8-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "v8",
            "initial_shape": "sphere",
            "objective_mode": "C",
            "objective_sense": "min",
            "i_axis": 0,
            "j_axis": 0,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
            "convergence_window": 5,
            "convergence_rtol_jraw": 5e-3,
            "ns_alpha_j": 0.5,
            "ns_alpha_c": 0.5,
            "surface_area_factor": 1.05,
            "shift_x": 0.0,
            "shift_y": 0.0,
            "shift_z": 0.0,
            "final_refine": True,
            "final_hmax_factor": 0.1,
            "final_hmin_ratio": 0.1,
            "final_hausd_ratio": 3.0,
            "final_rmc": 1e-4,
            "smooth_steps": 1,
            "smooth_eps_factor": 1.0,
            "smooth_iso_shift": 0.0,
            "feature_smooth_kappa_factor": 1.0,
            "feature_smooth_min_weight": 0.08,
            "camera_preset": "isometric",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
    {
        "name": "3D-3Dv9-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "v9",
            "initial_shape": "sphere",
            "objective_mode": "C",
            "objective_sense": "min",
            "i_axis": 0,
            "j_axis": 0,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
            "convergence_window": 5,
            "convergence_rtol_jraw": 5e-3,
            "ns_alpha_j": 0.5,
            "ns_alpha_c": 0.5,
            "surface_area_factor": 1.05,
            "area_correction_gain": 0.1,
            "area_gram_rel_tol": 1e-3,
            "shift_x": 0.0,
            "shift_y": 0.0,
            "shift_z": 0.0,
            "camera_preset": "isometric",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
    {
        "name": "3D-3Dv10_test-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "v10_test",
            "initial_shape": "sphere",
            "objective_mode": "C",
            "objective_sense": "min",
            "i_axis": 0,
            "j_axis": 0,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
            "convergence_window": 5,
            "convergence_rtol_jraw": 5e-3,
            "ns_alpha_j": 0.5,
            "ns_alpha_c": 0.5,
            "surface_area_factor": 1.05,
            "shift_x": 0.0,
            "shift_y": 0.0,
            "shift_z": 0.0,
            "camera_preset": "isometric",
            "fps": 5,
            "width": 960,
            "height": 540,
            "color_by": "solid",
            "show_edges": False,
        },
    },
    {
        "name": "3D-3Dv11_test-sphere",
        "config": {
            "dimension": "3d",
            "algorithm": "v11_test",
            "initial_shape": "sphere",
            "objective_mode": "C",
            "objective_sense": "min",
            "i_axis": 0,
            "j_axis": 0,
            "max_iters": 20,
            "step_k": 0.1,
            "hmax": DEFAULT_HMAX,
            "hmin_ratio": DEFAULT_HMIN_RATIO,
            "hausd_ratio": DEFAULT_HAUSD_RATIO,
            "convergence_window": 5,
            "convergence_rtol_jraw": 5e-2,
            "ns_alpha_j": 0.5,
            "ns_alpha_c": 0.5,
            "surface_area_factor": 1.05,
            "shift_x": 0.0,
            "shift_y": 0.0,
            "shift_z": 0.0,
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
    algorithm: Literal["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"]
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
    hilbert_alpha_factor: float = Field(default=16.0, gt=0)
    surface_area_factor: float = Field(default=1.05, gt=0)
    area_correction_gain: float = Field(default=0.1, ge=0)
    area_gram_rel_tol: float = Field(default=1e-3, ge=0)
    shift_x: float = 0.0
    shift_y: float = 0.0
    shift_z: float = 0.0
    final_refine: bool = True
    final_hmax_factor: float = Field(default=0.1, gt=0)
    final_hmin_ratio: float = Field(default=0.1, gt=0)
    final_hausd_ratio: float = Field(default=3.0, gt=0)
    final_rmc: float = Field(default=1e-4, gt=0)
    smooth_steps: int = Field(default=1, ge=1, le=50)
    smooth_eps_factor: float = Field(default=1.0, gt=0)
    smooth_iso_shift: float = 0.0
    feature_smooth_kappa_factor: float = Field(default=1.0, gt=0)
    feature_smooth_min_weight: float = Field(default=0.08, ge=0, le=1)
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


class PostSmoothRequest(BaseModel):
    mesh_name: str | None = None
    final_hmax_factor: float = Field(default=0.1, gt=0)
    final_hmin_ratio: float = Field(default=0.1, gt=0)
    final_hausd_ratio: float = Field(default=3.0, gt=0)
    final_rmc: float = Field(default=1e-4, gt=0)
    smooth_steps: int = Field(default=1, ge=1, le=50)
    smooth_eps_factor: float = Field(default=1.0, gt=0)
    smooth_iso_shift: float = 0.0
    smooth_mode: Literal["global", "feature"] = "global"
    feature_smooth_kappa_factor: float = Field(default=0.1, gt=0)
    feature_smooth_min_weight: float = Field(default=0.08, ge=0, le=1)


def model_fields_set(model: BaseModel) -> set[str]:
    fields_set = getattr(model, "model_fields_set", None)
    if fields_set is None:
        fields_set = getattr(model, "__fields_set__", set())
    return set(fields_set)


def effective_smooth_eps_factor(config: JobConfig) -> float:
    if config.algorithm == "v7" and "smooth_eps_factor" not in model_fields_set(config):
        return 0.1
    return config.smooth_eps_factor


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def parse_iso_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def compute_duration_seconds(meta: dict[str, Any]) -> int | None:
    started = parse_iso_datetime(meta.get("started_at")) or parse_iso_datetime(meta.get("created_at"))
    if started is None:
        return None
    finished = parse_iso_datetime(meta.get("finished_at")) or datetime.now()
    return max(0, int((finished - started).total_seconds()))


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


def find_xdmf_path(experiment_dir: Path, target_info: dict[str, Any]) -> Path | None:
    names = [target_info["xdmf"], *target_info.get("xdmf_aliases", [])]
    for name in names:
        candidate = experiment_dir / "out" / name
        if candidate.exists():
            return candidate
    return None


def supports_objective_mode(config: JobConfig) -> bool:
    if config.objective_mode == "K":
        return True
    if config.objective_mode == "C":
        return config.algorithm in {"v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}
    if config.objective_mode == "Q":
        return config.algorithm in {"v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}
    return False


def supports_objective_sense(config: JobConfig) -> bool:
    return config.algorithm in {"v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}


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
    if config.algorithm in {"v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
        env["CONVERGENCE_WINDOW"] = str(config.convergence_window)
        env["CONVERGENCE_RTOL_JRAW"] = str(config.convergence_rtol_jraw)
    if config.algorithm in {"v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
        env["NS_ALPHA_J"] = str(config.ns_alpha_j)
        env["NS_ALPHA_C"] = str(config.ns_alpha_c)
    if config.algorithm == "v6":
        env["HILBERT_ALPHA_FACTOR"] = str(config.hilbert_alpha_factor)
    if config.algorithm in {"v4", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
        env["SURFACE_AREA_FACTOR"] = str(config.surface_area_factor)
    if config.algorithm == "v9":
        env["AREA_CORRECTION_GAIN"] = str(config.area_correction_gain)
        env["AREA_GRAM_REL_TOL"] = str(config.area_gram_rel_tol)
    if config.algorithm in {"v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
        env["SHIFT_X"] = str(config.shift_x)
        env["SHIFT_Y"] = str(config.shift_y)
        env["SHIFT_Z"] = str(config.shift_z)
    if config.algorithm in {"v3", "v4", "v5", "v7", "v8"}:
        env["FINAL_REFINE"] = "1" if config.final_refine else "0"
        env["FINAL_HMAX_FACTOR"] = str(config.final_hmax_factor)
        env["FINAL_HMIN_RATIO"] = str(config.final_hmin_ratio)
        env["FINAL_HAUSD_RATIO"] = str(config.final_hausd_ratio)
        env["FINAL_RMC"] = str(config.final_rmc)
        env["SMOOTH_STEPS"] = str(config.smooth_steps)
        env["SMOOTH_EPS_FACTOR"] = str(effective_smooth_eps_factor(config))
        env["SMOOTH_ISO_SHIFT"] = str(config.smooth_iso_shift)
    if config.algorithm == "v8":
        env["FEATURE_SMOOTH_KAPPA_FACTOR"] = str(config.feature_smooth_kappa_factor)
        env["FEATURE_SMOOTH_MIN_WEIGHT"] = str(config.feature_smooth_min_weight)
    if config.algorithm == "v1" and config.penalty is not None:
        env["AL_PENALTY"] = str(config.penalty)
    return env


def build_postsmooth_env(
    config: dict[str, Any],
    request: PostSmoothRequest,
    mesh_path: str,
    output_mesh_path: Path | None = None,
) -> dict[str, str]:
    env = os.environ.copy()
    env["MESH"] = mesh_path
    if output_mesh_path:
        env["OUTPUT_MESH"] = str(output_mesh_path)
    env["HMAX"] = str(config.get("hmax", DEFAULT_HMAX))
    env["FINAL_HMAX_FACTOR"] = str(request.final_hmax_factor)
    env["FINAL_HMIN_RATIO"] = str(request.final_hmin_ratio)
    env["FINAL_HAUSD_RATIO"] = str(request.final_hausd_ratio)
    env["FINAL_RMC"] = str(request.final_rmc)
    env["SMOOTH_STEPS"] = str(request.smooth_steps)
    env["SMOOTH_EPS_FACTOR"] = str(request.smooth_eps_factor)
    env["SMOOTH_ISO_SHIFT"] = str(request.smooth_iso_shift)
    env["SMOOTH_MODE"] = request.smooth_mode
    env["FEATURE_SMOOTH_KAPPA_FACTOR"] = str(request.feature_smooth_kappa_factor)
    env["FEATURE_SMOOTH_MIN_WEIGHT"] = str(request.feature_smooth_min_weight)
    return env


def used_config_payload(config: JobConfig, resolved_mesh_path: str, initial_shape_label: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "dimension": config.dimension,
        "algorithm": config.algorithm,
        "initial_shape": config.initial_shape,
        "initial_shape_label": initial_shape_label,
        "objective_mode": config.objective_mode,
        "objective_sense": config.objective_sense,
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

    if config.mesh_path and config.initial_shape == "custom":
        payload["mesh_path"] = resolved_mesh_path

    if config.algorithm in {"v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
        payload["convergence_window"] = config.convergence_window
        payload["convergence_rtol_jraw"] = config.convergence_rtol_jraw

    if config.algorithm in {"v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
        payload["ns_alpha_j"] = config.ns_alpha_j
        payload["ns_alpha_c"] = config.ns_alpha_c

    if config.algorithm == "v6":
        payload["hilbert_alpha_factor"] = config.hilbert_alpha_factor

    if config.algorithm in {"v4", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
        payload["surface_area_factor"] = config.surface_area_factor

    if config.algorithm == "v9":
        payload["area_correction_gain"] = config.area_correction_gain
        payload["area_gram_rel_tol"] = config.area_gram_rel_tol

    if config.algorithm in {"v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
        payload["shift_x"] = config.shift_x
        payload["shift_y"] = config.shift_y
        payload["shift_z"] = config.shift_z

    if config.algorithm in {"v3", "v4", "v5", "v7", "v8"}:
        payload["final_refine"] = config.final_refine
        payload["final_hmax_factor"] = config.final_hmax_factor
        payload["final_hmin_ratio"] = config.final_hmin_ratio
        payload["final_hausd_ratio"] = config.final_hausd_ratio
        payload["final_rmc"] = config.final_rmc
        payload["smooth_steps"] = config.smooth_steps
        payload["smooth_eps_factor"] = effective_smooth_eps_factor(config)
        payload["smooth_iso_shift"] = config.smooth_iso_shift

    if config.algorithm == "v8":
        payload["feature_smooth_kappa_factor"] = config.feature_smooth_kappa_factor
        payload["feature_smooth_min_weight"] = config.feature_smooth_min_weight

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
        if algorithm in {"v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
            return ["iter", "objective"]
        return ["iter", "objective", "objective_aug"]
    if history_name == "obj_raw.txt":
        return ["iter", "objective_raw"]
    if history_name == "obj_before.txt":
        return ["iter", "objective_raw", "objective"]
    if history_name == "vol.txt":
        if algorithm in {"v4", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
            return ["iter", "volume", "violation", "area", "area_violation", "area_active"]
        return ["iter", "volume", "violation"]
    if history_name == "al.txt":
        return ["lambda", "penalty"]
    if history_name == "ns.txt":
        if algorithm in {"v4", "v6", "v7", "v8", "v9", "v10_test", "v11_test"}:
            return ["iter", "alpha_j", "alpha_c", "area_active", "proj_v", "proj_a", "range_v", "range_a", "max_xi_j", "max_xi_c"]
        return ["iter", "alpha_j", "alpha_c", "proj_coeff", "range_coeff", "max_xi_j", "max_xi_c"]
    if history_name == "centroid.txt":
        return ["iter", "centroid_x", "centroid_y", "centroid_z"]
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
OMEGA_POSTSMOOTH_ITERATION_RE = re.compile(r"Omega\.(\d+)\.postsmooth\.mesh$")


def postsmooth_mesh_name(mesh_name: str) -> str:
    if mesh_name == "Omega.final.mesh":
        return "Omega.final.postsmooth.mesh"
    match = OMEGA_ITERATION_RE.fullmatch(mesh_name)
    if match:
        return f"Omega.{match.group(1)}.postsmooth.mesh"
    stem = mesh_name[:-5] if mesh_name.endswith(".mesh") else mesh_name
    return f"{stem}.postsmooth.mesh"


def mesh_sort_key(name: str) -> tuple[int, int, str]:
    match = OMEGA_ITERATION_RE.fullmatch(name)
    if match:
        return (0, int(match.group(1)), name)
    match = OMEGA_POSTSMOOTH_ITERATION_RE.fullmatch(name)
    if match:
        return (1, int(match.group(1)), name)
    if name == "Omega.final.mesh":
        return (2, 0, name)
    if name in {"Omega.final.postsmooth.mesh", "Omega.postsmooth.mesh"}:
        return (3, 0, name)
    return (4, 0, name)


def resolve_experiment_mesh_path(experiment_dir: Path, mesh_name: str) -> Path:
    if "/" in mesh_name or "\\" in mesh_name or mesh_name in {"", ".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid mesh name.")
    if not mesh_name.startswith("Omega.") or not mesh_name.endswith(".mesh"):
        raise HTTPException(status_code=400, detail="Invalid mesh name.")
    path = (experiment_dir / "out" / mesh_name).resolve()
    out_dir = (experiment_dir / "out").resolve()
    if path.parent != out_dir:
        raise HTTPException(status_code=400, detail="Invalid mesh name.")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Mesh not found.")
    return path


def list_mesh_options(experiment_dir: Path) -> list[dict[str, Any]]:
    out_dir = experiment_dir / "out"
    if not out_dir.exists():
        return []

    names = {
        path.name
        for path in out_dir.glob("Omega*.mesh")
        if path.is_file() and path.name.startswith("Omega.") and path.name.endswith(".mesh")
    }
    if not names:
        return []

    default_path = find_final_mesh_path(experiment_dir)
    default_name = default_path.name if default_path else sorted(names, key=mesh_sort_key)[-1]
    options: list[dict[str, Any]] = []
    for name in sorted(names, key=mesh_sort_key):
        smooth_name = postsmooth_mesh_name(name)
        is_smooth = name.endswith(".postsmooth.mesh") or name == "Omega.postsmooth.mesh"
        options.append(
            {
                "name": name,
                "label": name,
                "is_default": name == default_name,
                "is_smooth": is_smooth,
                "smooth_name": smooth_name,
                "has_smooth": smooth_name in names,
            }
        )
    return options


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


def find_postsmooth_mesh_path(experiment_dir: Path) -> Path | None:
    final_postsmooth = experiment_dir / "out" / "Omega.final.postsmooth.mesh"
    if final_postsmooth.exists():
        return final_postsmooth
    path = experiment_dir / "out" / "Omega.postsmooth.mesh"
    return path if path.exists() else None


def parse_medit_mesh(mesh_path: Path) -> tuple[list[tuple[float, float, float]], list[tuple[int, int, int, int]], list[tuple[int, int, int, int, int]]]:
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
    return vertices, triangles, tetrahedra


def tetra_face_refs(tetrahedra: list[tuple[int, int, int, int, int]]) -> dict[tuple[int, int, int], set[int]]:
    face_refs: dict[tuple[int, int, int], set[int]] = {}
    for a, b, c, d, ref in tetrahedra:
        for face in ((a, b, c), (a, b, d), (a, c, d), (b, c, d)):
            key = tuple(sorted(face))
            refs = face_refs.setdefault(key, set())
            refs.add(ref)
    return face_refs


def tetra_face_counts(tetrahedra: list[tuple[int, int, int, int, int]]) -> dict[tuple[int, int, int], int]:
    counts: dict[tuple[int, int, int], int] = {}
    for a, b, c, d, _ref in tetrahedra:
        for face in ((a, b, c), (a, b, d), (a, c, d), (b, c, d)):
            key = tuple(sorted(face))
            counts[key] = counts.get(key, 0) + 1
    return counts


def surface_polydata(
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, int, int]],
    selection_mode: str,
) -> dict[str, Any]:
    index_map: dict[int, int] = {}
    points: list[float] = []
    polys: list[int] = []

    for a, b, c in faces:
        local = []
        for old_index in (a, b, c):
            if old_index < 1 or old_index > len(vertices):
                raise ValueError(f"Triangle index out of range: {old_index}")
            if old_index not in index_map:
                index_map[old_index] = len(index_map)
                x, y, z = vertices[old_index - 1]
                points.extend((x, y, z))
            local.append(index_map[old_index])
        polys.extend((3, local[0], local[1], local[2]))

    if index_map:
        used_vertices = [vertices[old_index - 1] for old_index in index_map]
        xs = [point[0] for point in used_vertices]
        ys = [point[1] for point in used_vertices]
        zs = [point[2] for point in used_vertices]
        bounds = [min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)]
    else:
        bounds = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

    return {
        "triangle_count": len(faces),
        "point_count": len(index_map),
        "selection_mode": selection_mode,
        "points": points,
        "polys": polys,
        "bounds": bounds,
    }


def selected_obstacle_faces(
    triangles: list[tuple[int, int, int, int]],
    tetrahedra: list[tuple[int, int, int, int, int]],
    preferred_refs: set[int],
) -> tuple[list[tuple[int, int, int]], str]:
    if tetrahedra:
        face_refs = tetra_face_refs(tetrahedra)
        interface_faces = [
            face
            for face, refs in face_refs.items()
            if PHASE_OBSTACLE in refs and PHASE_FLUID in refs
        ]
        if interface_faces:
            return interface_faces, "tet-interface"

    selected = [tri for tri in triangles if tri[3] in preferred_refs]
    if selected:
        return [(a, b, c) for a, b, c, _ref in selected], "triangle-ref"
    return [(a, b, c) for a, b, c, _ref in triangles], "triangle-all"


def selected_domain_faces(
    triangles: list[tuple[int, int, int, int]],
    tetrahedra: list[tuple[int, int, int, int, int]],
) -> tuple[list[tuple[int, int, int]], str]:
    if tetrahedra:
        exterior_faces = [face for face, count in tetra_face_counts(tetrahedra).items() if count == 1]
        if exterior_faces:
            return exterior_faces, "tet-exterior"
    return [(a, b, c) for a, b, c, _ref in triangles], "triangle-all"


def empty_velocity(timestep: int | None = None) -> dict[str, Any]:
    return {
        "timestep": timestep,
        "count": 0,
        "min_magnitude": 0.0,
        "max_magnitude": 0.0,
        "positions": [],
        "vectors": [],
    }


def parse_medit_scene_polydata(
    mesh_path: Path,
    preferred_refs: set[int] | None = None,
    velocity: dict[str, Any] | None = None,
) -> dict[str, Any]:
    preferred = preferred_refs or {13}
    vertices, triangles, tetrahedra = parse_medit_mesh(mesh_path)
    obstacle_faces, obstacle_mode = selected_obstacle_faces(triangles, tetrahedra, preferred)
    domain_faces, domain_mode = selected_domain_faces(triangles, tetrahedra)
    obstacle = surface_polydata(vertices, obstacle_faces, obstacle_mode)
    domain = surface_polydata(vertices, domain_faces, domain_mode)
    return {
        "source": mesh_path.name,
        "triangle_count": obstacle["triangle_count"],
        "point_count": obstacle["point_count"],
        "selection_mode": obstacle["selection_mode"],
        "used_reference_filter": obstacle["selection_mode"] == "triangle-ref",
        "points": obstacle["points"],
        "polys": obstacle["polys"],
        "obstacle": obstacle,
        "domain": domain,
        "velocity": velocity or empty_velocity(),
    }


def parse_medit_surface_polydata(mesh_path: Path, preferred_refs: set[int] | None = None) -> dict[str, Any]:
    scene = parse_medit_scene_polydata(mesh_path, preferred_refs)
    obstacle = scene["obstacle"]
    return {
        "source": mesh_path.name,
        "triangle_count": obstacle["triangle_count"],
        "point_count": obstacle["point_count"],
        "selection_mode": obstacle["selection_mode"],
        "used_reference_filter": obstacle["selection_mode"] == "triangle-ref",
        "points": obstacle["points"],
        "polys": obstacle["polys"],
    }


def mesh_timestep_index(mesh_name: str, latest_timestep: int | None) -> int | None:
    match = OMEGA_ITERATION_RE.fullmatch(mesh_name)
    if match:
        return int(match.group(1))
    if mesh_name in {"Omega.final.mesh", "Omega.final.postsmooth.mesh", "Omega.postsmooth.mesh"}:
        return latest_timestep
    smooth_match = OMEGA_POSTSMOOTH_ITERATION_RE.fullmatch(mesh_name)
    if smooth_match:
        return int(smooth_match.group(1))
    return latest_timestep


def xdmf_name(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1]


def xdmf_children(element: ET.Element, name: str) -> list[ET.Element]:
    return [child for child in list(element) if xdmf_name(child) == name]


def xdmf_child(element: ET.Element, name: str) -> ET.Element | None:
    for child in list(element):
        if xdmf_name(child) == name:
            return child
    return None


def xdmf_state_grids(xdmf_path: Path) -> list[ET.Element]:
    root = ET.parse(xdmf_path).getroot()
    for grid in root.iter():
        if xdmf_name(grid) != "Grid":
            continue
        if grid.attrib.get("Name") == "state" and grid.attrib.get("GridType") == "Collection":
            return [
                child
                for child in xdmf_children(grid, "Grid")
                if child.attrib.get("GridType") == "Uniform"
            ]
    return []


def xdmf_latest_timestep(xdmf_path: Path) -> int | None:
    grids = xdmf_state_grids(xdmf_path)
    return len(grids) - 1 if grids else None


def xdmf_data_item_path(xdmf_path: Path, data_item: ET.Element | None) -> tuple[Path, str] | None:
    if data_item is None or not data_item.text:
        return None
    text = data_item.text.strip()
    if ":" not in text:
        return None
    file_name, dataset = text.split(":", 1)
    return (xdmf_path.parent / file_name).resolve(), dataset


def xdmf_attribute_data_item(grid: ET.Element, attribute_name: str) -> ET.Element | None:
    for attribute in xdmf_children(grid, "Attribute"):
        if attribute.attrib.get("Name") == attribute_name:
            return xdmf_child(attribute, "DataItem")
    return None


def read_hdf_array(file_path: Path, dataset: str) -> Any:
    import h5py

    with h5py.File(file_path, "r") as handle:
        return handle[dataset][()]


def read_velocity_samples(xdmf_path: Path | None, timestep: int | None, max_samples: int = 420) -> dict[str, Any]:
    if xdmf_path is None or timestep is None:
        return empty_velocity(timestep)
    try:
        grids = xdmf_state_grids(xdmf_path)
        if not grids:
            return empty_velocity(timestep)
        grid_index = max(0, min(timestep, len(grids) - 1))
        grid = grids[grid_index]
        geometry = xdmf_child(grid, "Geometry")
        points_item = xdmf_child(geometry, "DataItem") if geometry is not None else None
        vectors_item = xdmf_attribute_data_item(grid, "u")
        points_ref = xdmf_data_item_path(xdmf_path, points_item)
        vectors_ref = xdmf_data_item_path(xdmf_path, vectors_item)
        if points_ref is None or vectors_ref is None:
            return empty_velocity(grid_index)

        points = read_hdf_array(*points_ref)
        vectors = read_hdf_array(*vectors_ref)
        count = min(len(points), len(vectors))
        samples: list[tuple[float, tuple[float, float, float], tuple[float, float, float]]] = []
        for i in range(count):
            vx, vy, vz = float(vectors[i][0]), float(vectors[i][1]), float(vectors[i][2])
            magnitude = math.sqrt(vx * vx + vy * vy + vz * vz)
            if magnitude <= 1e-12:
                continue
            px, py, pz = float(points[i][0]), float(points[i][1]), float(points[i][2])
            samples.append((magnitude, (px, py, pz), (vx, vy, vz)))

        if not samples:
            return empty_velocity(grid_index)

        stride = max(1, math.ceil(len(samples) / max_samples))
        selected = samples[::stride][:max_samples]
        positions: list[float] = []
        sampled_vectors: list[float] = []
        magnitudes: list[float] = []
        for magnitude, position, vector in selected:
            magnitudes.append(magnitude)
            positions.extend(position)
            sampled_vectors.extend(vector)

        return {
            "timestep": grid_index,
            "count": len(selected),
            "min_magnitude": min(magnitudes),
            "max_magnitude": max(magnitudes),
            "positions": positions,
            "vectors": sampled_vectors,
        }
    except Exception:
        return empty_velocity(timestep)


def parse_experiment_mesh_scene(experiment_dir: Path, mesh_path: Path, target_info: dict[str, Any] | None) -> dict[str, Any]:
    xdmf_path = find_xdmf_path(experiment_dir, target_info) if target_info else None
    latest = xdmf_latest_timestep(xdmf_path) if xdmf_path else None
    timestep = mesh_timestep_index(mesh_path.name, latest)
    velocity = read_velocity_samples(xdmf_path, timestep)
    return parse_medit_scene_polydata(mesh_path, velocity=velocity)


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
    summary["duration_seconds"] = compute_duration_seconds(meta)

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
    postsmooth_mesh_path = find_postsmooth_mesh_path(experiment_dir)
    mesh_options = list_mesh_options(experiment_dir)
    postsmooth_config = read_json(experiment_dir / "postsmooth-config.json", None)
    xdmf_path = find_xdmf_path(experiment_dir, target_info) if target_info else None
    return {
        "id": experiment_dir.name,
        "config": config,
        "postsmooth_config": postsmooth_config,
        "meta": meta,
        "summary": summary,
        "series": series,
        "log_tail": log_text,
        "diagnostics": extract_diagnostics(log_text),
        "preview_urls": previews,
        "final_urls": finals,
        "xdmf_url": experiment_artifact_url(experiment_dir.name, f"out/{xdmf_path.name}") if xdmf_path else None,
        "mesh_options": mesh_options,
        "final_mesh_url": f"/api/experiments/{experiment_dir.name}/final-mesh" if final_mesh_path else None,
        "postsmooth_mesh_url": (
            f"/api/experiments/{experiment_dir.name}/postsmooth-mesh" if postsmooth_mesh_path else None
        ),
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
        xdmf_path = find_xdmf_path(experiment_dir, target_info)
        if not xdmf_path:
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
        xdmf_path = find_xdmf_path(job.experiment_dir, job.target_info)
        if not xdmf_path:
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
            detail="当前组合暂不支持该目标模式。现阶段 C/Q 仅支持 v1、v2、v3、v4、v5、v6、v7、v8、v9、v10_test、v11_test。",
        )
    if config.objective_sense == "max" and not supports_objective_sense(config):
        raise HTTPException(
            status_code=400,
            detail="当前组合暂不支持 max 模式。现阶段 min/max 仅支持 v1、v2、v3、v4、v5、v6、v7、v8、v9、v10_test、v11_test。",
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
    raw_config = read_json(path / "config.json", {})
    config = normalize_config_dict(raw_config) if raw_config else {}
    target_info = TARGETS.get((config.get("dimension"), config.get("algorithm")))
    try:
        return parse_experiment_mesh_scene(path, mesh_path, target_info)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/experiments/{experiment_id}/mesh")
def api_experiment_mesh(experiment_id: str, name: str) -> dict[str, Any]:
    path = EXPERIMENTS_DIR / experiment_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Experiment not found.")
    mesh_path = resolve_experiment_mesh_path(path, name)
    raw_config = read_json(path / "config.json", {})
    config = normalize_config_dict(raw_config) if raw_config else {}
    target_info = TARGETS.get((config.get("dimension"), config.get("algorithm")))
    try:
        return parse_experiment_mesh_scene(path, mesh_path, target_info)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/experiments/{experiment_id}/postsmooth-mesh")
def api_experiment_postsmooth_mesh(experiment_id: str) -> dict[str, Any]:
    path = EXPERIMENTS_DIR / experiment_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Experiment not found.")
    mesh_path = find_postsmooth_mesh_path(path)
    if not mesh_path:
        raise HTTPException(status_code=404, detail="Post-smoothed mesh not found.")
    try:
        return parse_medit_surface_polydata(mesh_path)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/experiments/{experiment_id}/post-smooth")
def api_experiment_post_smooth(experiment_id: str, request: PostSmoothRequest) -> dict[str, Any]:
    path = EXPERIMENTS_DIR / experiment_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Experiment not found.")
    if manager.is_running(experiment_id):
        raise HTTPException(status_code=409, detail="Cannot run post-smooth while the experiment is running.")

    experiment = read_experiment(path)
    config = experiment["config"]
    if request.mesh_name:
        mesh_path = resolve_experiment_mesh_path(path, request.mesh_name)
    else:
        mesh_path = find_final_mesh_path(path)
        if not mesh_path:
            raise HTTPException(status_code=404, detail="Final mesh not found.")

    output_name = postsmooth_mesh_name(mesh_path.name)
    output_path = path / "out" / output_name

    build_target("PETSc_3DPostSmooth")
    request_payload = request.model_dump()
    request_payload["mesh_name"] = mesh_path.name
    request_payload["output_mesh_name"] = output_name
    write_json(path / "postsmooth-config.json", request_payload)
    write_json(path / f"postsmooth-config-{output_name.removesuffix('.mesh')}.json", request_payload)

    log_path = path / f"postsmooth-{output_name.removesuffix('.mesh')}.log"
    executable = BUILD_DIR / "examples/PETSc/LevelSetStokes" / "PETSc_3DPostSmooth"
    result = subprocess.run(
        [str(executable)],
        cwd=path,
        env=build_postsmooth_env(config, request, str(mesh_path), output_path),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    log_path.write_text(result.stdout or "", encoding="utf-8")

    if result.returncode != 0 or not output_path.exists():
        detail = tail_lines(log_path, 80) or "Post-smooth failed."
        raise HTTPException(status_code=500, detail=detail)

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
