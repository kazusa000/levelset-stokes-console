#!/usr/bin/env python3
from __future__ import annotations

import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, TwoSlopeNorm
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from scipy.spatial import cKDTree


OBSTACLE = 2
FLUID = 3
INTERFACE = 13


def read_medit_mesh(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    lines = [
        line.strip()
        for line in path.read_text(errors="replace").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    i = 0
    vertices: list[list[float]] = []
    triangles: list[list[int]] = []
    tetrahedra: list[list[int]] = []
    while i < len(lines):
        token = lines[i]
        if token == "Vertices":
            count = int(lines[i + 1])
            for row in lines[i + 2 : i + 2 + count]:
                x, y, z, *_ = row.split()
                vertices.append([float(x), float(y), float(z)])
            i += 2 + count
            continue
        if token == "Triangles":
            count = int(lines[i + 1])
            for row in lines[i + 2 : i + 2 + count]:
                a, b, c, ref = row.split()
                triangles.append([int(a) - 1, int(b) - 1, int(c) - 1, int(ref)])
            i += 2 + count
            continue
        if token == "Tetrahedra":
            count = int(lines[i + 1])
            for row in lines[i + 2 : i + 2 + count]:
                a, b, c, d, ref = row.split()
                tetrahedra.append([int(a) - 1, int(b) - 1, int(c) - 1, int(d) - 1, int(ref)])
            i += 2 + count
            continue
        i += 1

    if not vertices:
        raise ValueError(f"No vertices found in {path}")

    return (
        np.asarray(vertices, dtype=float),
        np.asarray(triangles, dtype=int),
        np.asarray(tetrahedra, dtype=int),
    )


def extract_surface(vertices: np.ndarray, triangles: np.ndarray, tetrahedra: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if tetrahedra.size:
        face_map: dict[tuple[int, int, int], set[int]] = {}
        tet_faces = ((1, 2, 3), (0, 3, 2), (0, 1, 3), (0, 2, 1))
        for tet in tetrahedra:
            tet_vertices = tet[:4]
            tet_ref = int(tet[4])
            for face in tet_faces:
                key = tuple(sorted((int(tet_vertices[face[0]]), int(tet_vertices[face[1]]), int(tet_vertices[face[2]]))))
                face_map.setdefault(key, set()).add(tet_ref)
        selected = [list(face) for face, refs in face_map.items() if OBSTACLE in refs and FLUID in refs]
        if selected:
            surface = np.asarray(selected, dtype=int)
        else:
            surface = np.empty((0, 3), dtype=int)
    else:
        surface = np.empty((0, 3), dtype=int)

    if surface.size == 0 and triangles.size:
        preferred = triangles[triangles[:, 3] == INTERFACE][:, :3]
        surface = preferred if preferred.size else triangles[:, :3]

    if surface.size == 0:
        raise ValueError("No surface triangles found.")

    unique_ids = np.unique(surface.reshape(-1))
    remap = {old: idx for idx, old in enumerate(unique_ids.tolist())}
    remapped = np.vectorize(remap.__getitem__)(surface)
    return vertices[unique_ids], remapped.astype(int)


def ray_intersections(point: np.ndarray, tri_vertices: np.ndarray) -> int:
    direction = np.array([1.0, 0.371, 0.127], dtype=float)
    v0 = tri_vertices[:, 0, :]
    v1 = tri_vertices[:, 1, :]
    v2 = tri_vertices[:, 2, :]
    eps = 1e-9

    edge1 = v1 - v0
    edge2 = v2 - v0
    h = np.cross(np.broadcast_to(direction, edge2.shape), edge2)
    a = np.einsum("ij,ij->i", edge1, h)
    mask = np.abs(a) > eps
    if not np.any(mask):
        return 0

    f = np.zeros_like(a)
    f[mask] = 1.0 / a[mask]
    s = point - v0
    u = f * np.einsum("ij,ij->i", s, h)
    q = np.cross(s, edge1)
    v = f * np.einsum("j,ij->i", direction, q)
    t = f * np.einsum("ij,ij->i", edge2, q)

    hits = mask & (u >= -eps) & (v >= -eps) & (u + v <= 1.0 + eps) & (t > eps)
    return int(np.count_nonzero(hits))


def points_inside(points: np.ndarray, prev_vertices: np.ndarray, prev_triangles: np.ndarray) -> np.ndarray:
    tri_vertices = prev_vertices[prev_triangles]
    inside = np.zeros(points.shape[0], dtype=bool)
    for i, point in enumerate(points):
        inside[i] = (ray_intersections(point, tri_vertices) % 2) == 1
    return inside


def compute_signed_displacement(
    curr_vertices: np.ndarray,
    prev_vertices: np.ndarray,
    prev_triangles: np.ndarray,
) -> np.ndarray:
    if prev_vertices.shape[0] == 0:
        return np.zeros(curr_vertices.shape[0], dtype=float)

    tree = cKDTree(prev_vertices)
    distances, _ = tree.query(curr_vertices, k=1)
    inside = points_inside(curr_vertices, prev_vertices, prev_triangles)
    # Positive means inward; negative means outward.
    return np.where(inside, distances, -distances)


def set_equal_axes(ax, vertices: np.ndarray) -> None:
    mins = vertices.min(axis=0)
    maxs = vertices.max(axis=0)
    center = 0.5 * (mins + maxs)
    radius = max(float(np.max(maxs - mins)) * 0.55, 1e-6)
    ax.set_xlim(center[0] - radius, center[0] + radius)
    ax.set_ylim(center[1] - radius, center[1] + radius)
    ax.set_zlim(center[2] - radius, center[2] + radius)
    ax.set_box_aspect((1, 1, 1))


def apply_camera(ax, preset: str) -> None:
    preset = preset.lower()
    if preset == "front":
        ax.view_init(elev=8, azim=-90)
    elif preset == "side":
        ax.view_init(elev=8, azim=0)
    elif preset == "top":
        ax.view_init(elev=90, azim=-90)
    else:
        ax.view_init(elev=24, azim=-55)


def render_frame(
    out_path: Path,
    vertices: np.ndarray,
    triangles: np.ndarray,
    scalars: np.ndarray,
    show_edges: bool,
    width: int,
    height: int,
    camera_preset: str,
    norm: TwoSlopeNorm,
    cmap: LinearSegmentedColormap,
) -> None:
    fig = plt.figure(figsize=(width / 100.0, height / 100.0), dpi=100)
    ax = fig.add_subplot(111, projection="3d")
    background = (0.32, 0.34, 0.44)
    fig.patch.set_facecolor(background)
    ax.set_facecolor(background)

    faces = vertices[triangles]
    face_scalars = scalars[triangles].mean(axis=1)
    colors = cmap(norm(face_scalars))
    collection = Poly3DCollection(
        faces,
        facecolors=colors,
        edgecolors=(0.10, 0.13, 0.18, 0.75) if show_edges else "none",
        linewidths=0.15 if show_edges else 0.0,
        antialiased=True,
    )
    ax.add_collection3d(collection)
    set_equal_axes(ax, vertices)
    apply_camera(ax, camera_preset)
    ax.set_axis_off()
    plt.subplots_adjust(0, 0, 1, 1)
    fig.savefig(out_path, dpi=100, facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close(fig)


def numeric_key(path: Path) -> tuple[int, str]:
    stem = path.stem
    try:
        return int(stem.split(".")[1]), path.name
    except Exception:
        return (10**9, path.name)


def main() -> int:
    input_path = Path(os.environ["INPUT"]).resolve()
    output_path = Path(os.environ["OUTPUT"]).resolve()
    fps = int(os.environ["FPS"])
    width = int(os.environ["WIDTH"])
    height = int(os.environ["HEIGHT"])
    show_edges = os.environ.get("SHOW_EDGES", "0") not in ("0", "", "false", "False", "no", "No")
    camera_preset = os.environ.get("CAMERA_PRESET", "default")

    out_dir = input_path.parent
    mesh_paths = sorted(
        [path for path in out_dir.glob("Omega.*.mesh") if path.name != "Omega.final.mesh"],
        key=numeric_key,
    )
    if not mesh_paths:
        print(f"No Omega.*.mesh files found in {out_dir}", file=sys.stderr)
        return 1

    surfaces: list[tuple[np.ndarray, np.ndarray]] = []
    displacements: list[np.ndarray] = []
    max_abs = 0.0

    for index, mesh_path in enumerate(mesh_paths):
        vertices, triangles, tetrahedra = read_medit_mesh(mesh_path)
        surface_vertices, surface_triangles = extract_surface(vertices, triangles, tetrahedra)
        surfaces.append((surface_vertices, surface_triangles))
        if index == 0:
            disp = np.zeros(surface_vertices.shape[0], dtype=float)
        else:
            prev_vertices, prev_triangles = surfaces[index - 1]
            disp = compute_signed_displacement(surface_vertices, prev_vertices, prev_triangles)
        displacements.append(disp)
        if disp.size:
            max_abs = max(max_abs, float(np.max(np.abs(disp))))

    max_abs = max(max_abs, 1e-9)
    norm = TwoSlopeNorm(vcenter=0.0, vmin=-max_abs, vmax=max_abs)
    cmap = LinearSegmentedColormap.from_list(
        "adjacent_displacement",
        ["#1f4aff", "#f7f8fb", "#d22a2a"],
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="adjacent_disp_", dir=str(output_path.parent)) as tmpdir:
        tmpdir_path = Path(tmpdir)
        for index, ((vertices, triangles), disp) in enumerate(zip(surfaces, displacements)):
            frame_path = tmpdir_path / f"frame.{index:04d}.png"
            render_frame(
                frame_path,
                vertices,
                triangles,
                disp,
                show_edges=show_edges,
                width=width,
                height=height,
                camera_preset=camera_preset,
                norm=norm,
                cmap=cmap,
            )

        if output_path.suffix.lower() == ".mp4":
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-framerate",
                    str(fps),
                    "-i",
                    str(tmpdir_path / "frame.%04d.png"),
                    "-vf",
                    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                    "-pix_fmt",
                    "yuv420p",
                    str(output_path),
                ],
                check=True,
            )
        else:
            for png in sorted(tmpdir_path.glob("frame.*.png")):
                target = output_path.parent / png.name
                target.write_bytes(png.read_bytes())

    print(f"Saved adjacent-displacement animation to: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
