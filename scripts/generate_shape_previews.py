#!/usr/bin/env python3
from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Iterable

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import matplotlib.tri as mtri
import numpy as np
from matplotlib.colors import LinearSegmentedColormap
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

ROOT = Path("/home/wjj/Project/stage")
RODIN = ROOT / "rodin" / "examples" / "PETSc" / "LevelSetStokes"
OUT = ROOT / "levelset-console" / "frontend" / "public" / "shape-previews"

SHAPES = {
    "3d": {
        "sphere": RODIN / "3dshapes" / "sphere_init_aligned.mesh",
        "sphere_bump": RODIN / "3dshapes" / "sphere_bump_init.mesh",
        "prolate": RODIN / "3dshapes" / "prolate_init.mesh",
        "oblate": RODIN / "3dshapes" / "oblate_init.mesh",
        "capsule": RODIN / "3dshapes" / "capsule_init.mesh",
        "double_sphere": RODIN / "3dshapes" / "double_sphere_init.mesh",
        "peanut": RODIN / "3dshapes" / "peanut_init.mesh",
        "three_lobe": RODIN / "3dshapes" / "three_lobe_init.mesh",
        "rounded_three_lobe": RODIN / "3dshapes" / "rounded_three_lobe_init.mesh",
        "rounded_four_lobe": RODIN / "3dshapes" / "rounded_four_lobe_init.mesh",
        "seven_lobe_star": RODIN / "3dshapes" / "seven_lobe_star_init.mesh",
        "dumbbell": RODIN / "3dshapes" / "dumbbell_init.mesh",
        "torus": RODIN / "3dshapes" / "torus_init.mesh",
    },
    "2d": {
        "circle": RODIN / "2dshapes" / "circle_init_2d.mesh",
        "annulus": RODIN / "2dshapes" / "annulus_init_2d.mesh",
        "eccentric_ring": RODIN / "2dshapes" / "eccentric_ring_init_2d.mesh",
        "double_hole": RODIN / "2dshapes" / "double_hole_init_2d.mesh",
    },
}


def parse_section(lines: list[str], key: str) -> list[str]:
    for i, line in enumerate(lines):
        if line.strip() == key:
            n = int(lines[i + 1].strip())
            return lines[i + 2 : i + 2 + n]
    return []


def mesh_dimension(lines: list[str]) -> int:
    for i, line in enumerate(lines):
        if line.strip() == "Dimension":
            return int(lines[i + 1].strip())
    raise ValueError(f"Missing Dimension section in {lines!r}")


def read_mesh(path: Path):
    lines = path.read_text().splitlines()
    dimension = mesh_dimension(lines)
    vertices_raw = parse_section(lines, "Vertices")
    triangles_raw = parse_section(lines, "Triangles")
    tetra_raw = parse_section(lines, "Tetrahedra")

    if dimension == 3:
        vertices = np.array([[float(x), float(y), float(z)] for x, y, z, *_ in (row.split() for row in vertices_raw)])
    else:
        vertices = np.array([[float(x), float(y), 0.0] for x, y, *_ in (row.split() for row in vertices_raw)])
    triangles = np.array([[int(a) - 1, int(b) - 1, int(c) - 1, int(ref)] for a, b, c, ref in (row.split() for row in triangles_raw)], dtype=int)
    tetra = np.array([[int(a) - 1, int(b) - 1, int(c) - 1, int(d) - 1, int(ref)] for a, b, c, d, ref in (row.split() for row in tetra_raw)], dtype=int) if tetra_raw else np.empty((0, 5), dtype=int)
    return dimension, vertices, triangles, tetra


def set_equal_3d(ax, pts: np.ndarray) -> None:
    mins = pts.min(axis=0)
    maxs = pts.max(axis=0)
    center = (mins + maxs) / 2.0
    radius = (maxs - mins).max() / 2.0
    ax.set_xlim(center[0] - radius, center[0] + radius)
    ax.set_ylim(center[1] - radius, center[1] + radius)
    ax.set_zlim(center[2] - radius, center[2] + radius)


def render_3d(mesh_path: Path, out_path: Path) -> None:
    _, vertices, triangles, _ = read_mesh(mesh_path)
    surface = triangles[triangles[:, 3] == 13][:, :3]
    faces = vertices[surface]

    normals = np.cross(faces[:, 1] - faces[:, 0], faces[:, 2] - faces[:, 0])
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = normals / np.maximum(norms, 1e-12)
    light = np.array([-0.35, -0.4, 0.85])
    light /= np.linalg.norm(light)
    intensity = np.clip(normals @ light, -1.0, 1.0)
    intensity = 0.35 + 0.65 * (intensity + 1.0) / 2.0

    base = np.array([0.74, 0.80, 0.92])
    shade = np.clip(base * intensity[:, None], 0, 1)

    fig = plt.figure(figsize=(2.8, 2.2), dpi=140)
    ax = fig.add_subplot(111, projection="3d", proj_type="ortho")
    poly = Poly3DCollection(faces, facecolors=shade, edgecolors="none", linewidths=0)
    ax.add_collection3d(poly)
    set_equal_3d(ax, vertices[np.unique(surface)])
    ax.view_init(elev=22, azim=-48)
    ax.set_axis_off()
    fig.patch.set_facecolor("#f4f8fd")
    ax.set_facecolor("#f4f8fd")
    plt.subplots_adjust(0, 0, 1, 1)
    fig.savefig(out_path, facecolor=fig.get_facecolor(), bbox_inches="tight", pad_inches=0.03)
    plt.close(fig)


def boundary_edges(tris: np.ndarray) -> np.ndarray:
    edges: list[tuple[int, int]] = []
    for a, b, c in tris:
        edges.extend([tuple(sorted((a, b))), tuple(sorted((b, c))), tuple(sorted((a, c)))])
    counts = Counter(edges)
    return np.array([edge for edge, count in counts.items() if count == 1], dtype=int)


def render_2d(mesh_path: Path, out_path: Path) -> None:
    _, vertices, triangles, _ = read_mesh(mesh_path)
    obstacle_tris = triangles[triangles[:, 3] == 2][:, :3]
    xy = vertices[:, :2]

    fig, ax = plt.subplots(figsize=(2.8, 2.2), dpi=140)
    triang = mtri.Triangulation(xy[:, 0], xy[:, 1], obstacle_tris)
    centroids = xy[obstacle_tris].mean(axis=1)
    shade = 0.55 + 0.3 * (centroids[:, 1] - centroids[:, 1].min()) / max(centroids[:, 1].ptp(), 1e-12)
    cmap = LinearSegmentedColormap.from_list("shape_preview", ["#a8c0eb", "#dfe9f8"])
    ax.tripcolor(triang, facecolors=shade, edgecolors="none", shading="flat", cmap=cmap, vmin=0, vmax=1)

    edges = boundary_edges(obstacle_tris)
    for a, b in edges:
        ax.plot([xy[a, 0], xy[b, 0]], [xy[a, 1], xy[b, 1]], color="#4b6ea9", linewidth=1.2)

    mins = xy[np.unique(obstacle_tris)].min(axis=0)
    maxs = xy[np.unique(obstacle_tris)].max(axis=0)
    center = (mins + maxs) / 2
    radius = max(maxs - mins) / 2
    pad = radius * 0.18
    ax.set_xlim(center[0] - radius - pad, center[0] + radius + pad)
    ax.set_ylim(center[1] - radius - pad, center[1] + radius + pad)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.patch.set_facecolor("#f4f8fd")
    ax.set_facecolor("#f4f8fd")
    plt.subplots_adjust(0, 0, 1, 1)
    fig.savefig(out_path, facecolor=fig.get_facecolor(), bbox_inches="tight", pad_inches=0.03)
    plt.close(fig)


def main() -> None:
    for dimension, entries in SHAPES.items():
        out_dir = OUT / dimension
        out_dir.mkdir(parents=True, exist_ok=True)
        for key, mesh_path in entries.items():
            out_path = out_dir / f"{key}.png"
            if dimension == "3d":
                render_3d(mesh_path, out_path)
            else:
                render_2d(mesh_path, out_path)
            print(f"generated {out_path}")


if __name__ == "__main__":
    main()
