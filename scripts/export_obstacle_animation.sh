#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INPUT="${INPUT:-}"
OUTPUT="${OUTPUT:-}"
FPS="${FPS:-5}"
WIDTH="${WIDTH:-1920}"
HEIGHT="${HEIGHT:-1080}"
REGION="${REGION:-2}"
COLOR_BY="${COLOR_BY:-solid}"
SHOW_EDGES="${SHOW_EDGES:-0}"
CAMERA_PRESET="${CAMERA_PRESET:-default}"

if [[ -z "$INPUT" || -z "$OUTPUT" ]]; then
  echo "INPUT and OUTPUT must be set." >&2
  exit 1
fi

export INPUT OUTPUT FPS WIDTH HEIGHT REGION COLOR_BY SHOW_EDGES CAMERA_PRESET

if [[ "$COLOR_BY" == "adjacent_displacement" ]]; then
  exec python3 "${SCRIPT_DIR}/export_adjacent_displacement_animation.py"
fi

if ! command -v pvpython >/dev/null 2>&1; then
  echo "pvpython not found in PATH." >&2
  exit 1
fi

if [[ "${OUTPUT##*.}" == "mp4" ]] && ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found in PATH; cannot assemble mp4." >&2
  exit 1
fi

export LIBGL_ALWAYS_SOFTWARE="${LIBGL_ALWAYS_SOFTWARE:-1}"
export PV_OFFSCREEN="${PV_OFFSCREEN:-1}"

if [[ -z "${DISPLAY:-}" ]]; then
  if command -v xvfb-run >/dev/null 2>&1; then
    export LEVELSET_USE_XVFB=1
  else
    for socket in /tmp/.X11-unix/X*; do
      if [[ -S "$socket" ]]; then
        export DISPLAY=":${socket##*/X}"
        break
      fi
    done
  fi
fi

if [[ -z "${XAUTHORITY:-}" ]]; then
  if [[ -f "/run/user/$(id -u)/gdm/Xauthority" ]]; then
    export XAUTHORITY="/run/user/$(id -u)/gdm/Xauthority"
  elif [[ -f "${HOME}/.Xauthority" ]]; then
    export XAUTHORITY="${HOME}/.Xauthority"
  fi
fi

if [[ -z "${DISPLAY:-}" && -z "${LEVELSET_USE_XVFB:-}" ]]; then
  echo "No DISPLAY available and xvfb-run is not installed." >&2
  exit 1
fi
PV_CMD=(pvpython --force-offscreen-rendering -)
if [[ "${LEVELSET_USE_XVFB:-0}" == "1" ]]; then
  PV_CMD=(xvfb-run -a "${PV_CMD[@]}")
fi

"${PV_CMD[@]}" <<'PY'
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile

from paraview.simple import (
    ColorBy,
    ExtractSurface,
    GetActiveViewOrCreate,
    GetAnimationScene,
    GetColorTransferFunction,
    GetOpacityTransferFunction,
    Hide,
    ResetCamera,
    SaveAnimation,
    SetActiveSource,
    Show,
    Threshold,
    XDMFReader,
    _DisableFirstRenderCameraReset,
)

input_path = os.environ["INPUT"]
output_path = os.environ["OUTPUT"]
fps = int(os.environ["FPS"])
width = int(os.environ["WIDTH"])
height = int(os.environ["HEIGHT"])
region = float(os.environ["REGION"])
color_by = os.environ["COLOR_BY"]
show_edges = os.environ["SHOW_EDGES"] not in ("0", "", "false", "False", "no", "No")
camera_preset = os.environ["CAMERA_PRESET"].lower()

if not os.path.isfile(input_path):
    print(f"Input file does not exist: {input_path}", file=sys.stderr)
    raise SystemExit(1)

os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

_DisableFirstRenderCameraReset()

reader = XDMFReader(FileNames=[input_path])
scene = GetAnimationScene()
scene.UpdateAnimationUsingDataTimeSteps()

render_view = GetActiveViewOrCreate("RenderView")
render_view.ViewSize = [width, height]
render_view.Background = [0.32, 0.34, 0.44]

SetActiveSource(reader)

threshold = Threshold(Input=reader)
threshold.Scalars = ["CELLS", "Region"]
threshold.LowerThreshold = region
threshold.UpperThreshold = region

surface = ExtractSurface(Input=threshold)

reader_display = Show(reader, render_view)
Hide(reader, render_view)
Hide(threshold, render_view)
del reader_display

surface_display = Show(surface, render_view)
surface_display.Representation = "Surface With Edges" if show_edges else "Surface"

if color_by == "solid":
    ColorBy(surface_display, None)
    surface_display.DiffuseColor = [0.16, 0.21, 0.72]
    surface_display.AmbientColor = [0.16, 0.21, 0.72]
elif color_by == "Region":
    ColorBy(surface_display, ("CELLS", "Region"))
    surface_display.RescaleTransferFunctionToDataRange(True, False)
else:
    ColorBy(surface_display, ("POINTS", color_by))
    lut = GetColorTransferFunction(color_by)
    pwf = GetOpacityTransferFunction(color_by)
    surface_display.LookupTable = lut
    surface_display.OpacityTransferFunction = pwf
    surface_display.RescaleTransferFunctionToDataRange(True, False)

ResetCamera(render_view)

camera = render_view.GetActiveCamera()
bounds = surface.GetDataInformation().GetBounds()
if bounds and all(v is not None for v in bounds):
    cx = 0.5 * (bounds[0] + bounds[1])
    cy = 0.5 * (bounds[2] + bounds[3])
    cz = 0.5 * (bounds[4] + bounds[5])
    span_x = max(bounds[1] - bounds[0], 1e-6)
    span_y = max(bounds[3] - bounds[2], 1e-6)
    span_z = max(bounds[5] - bounds[4], 1e-6)
    radius = max(span_x, span_y, span_z) * 1.8

    if camera_preset == "front":
        camera.SetPosition(cx, cy - radius, cz)
        camera.SetFocalPoint(cx, cy, cz)
        camera.SetViewUp(0, 0, 1)
    elif camera_preset == "side":
        camera.SetPosition(cx + radius, cy, cz)
        camera.SetFocalPoint(cx, cy, cz)
        camera.SetViewUp(0, 0, 1)
    elif camera_preset == "top":
        camera.SetPosition(cx, cy, cz + radius)
        camera.SetFocalPoint(cx, cy, cz)
        camera.SetViewUp(0, 1, 0)
    elif camera_preset == "isometric":
        camera.SetPosition(cx + radius, cy - radius, cz + radius)
        camera.SetFocalPoint(cx, cy, cz)
        camera.SetViewUp(0, 0, 1)

render_view.Update()

timesteps = getattr(scene.TimeKeeper, "TimestepValues", None)
frame_window = [0, len(timesteps) - 1] if timesteps else [0, 0]
output_ext = os.path.splitext(output_path)[1].lower()

if output_ext == ".mp4":
    with tempfile.TemporaryDirectory(prefix="pv_anim_", dir=os.path.dirname(os.path.abspath(output_path))) as tmpdir:
        frame_pattern = os.path.join(tmpdir, "frame.png")
        SaveAnimation(
            frame_pattern,
            render_view,
            ImageResolution=[width, height],
            FrameRate=fps,
            FrameWindow=frame_window,
        )
        seq_input = os.path.join(tmpdir, "frame.%04d.png")
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-framerate",
                str(fps),
                "-i",
                seq_input,
                "-vf",
                "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-pix_fmt",
                "yuv420p",
                output_path,
            ],
            check=True,
        )
else:
    SaveAnimation(
        output_path,
        render_view,
        ImageResolution=[width, height],
        FrameRate=fps,
        FrameWindow=frame_window,
    )

print(f"Saved animation to: {output_path}")
PY
