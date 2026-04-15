# LevelSetStokes Console

A local experiment console for the `examples/PETSc/LevelSetStokes` examples in `Rodin`.

It provides:

- a React + Vite frontend
- a FastAPI backend
- single-job experiment management
- experiment history storage
- preview and final animation export

## Repository Layout

- `backend/`
  FastAPI service for building targets, launching solvers, managing experiments, and exporting animations.
- `frontend/`
  React single-page application.
- `run.sh`
  Starts both frontend and backend together.

## Requirements

### Python

Backend dependencies:

- `fastapi`
- `uvicorn`

Install them with:

```bash
cd levelset-console/backend
python3 -m venv ../.venv
../.venv/bin/pip install -r requirements.txt
```

### Node.js

Frontend dependencies:

- `react`
- `react-dom`
- `recharts`
- `vite`
- `typescript`

Install them with:

```bash
cd levelset-console/frontend
npm install
```

### System Tools

The backend also depends on the following tools to build and render experiments:

- `cmake`
- a working C++ / MPI / PETSc toolchain
- `pvpython` from ParaView
- `ffmpeg`

## Relationship to Rodin

This console is not a standalone frontend demo. It launches the `LevelSetStokes` executables built from `Rodin`.

The default expected directory layout is:

```text
<workspace>/
  rodin/
  levelset-console/
    scripts/export_obstacle_animation.sh
    runs/experiments/
```

By default, the console uses its parent directory as the workspace root in order to locate `rodin/`.
The animation export script and experiment history are stored inside `levelset-console` itself.

If your layout is different, you can override the paths with environment variables.

## Configurable Environment Variables

You can create a `.env` file in the repository root, or export these variables directly in your shell:

```bash
LEVELSET_STAGE_DIR=/path/to/workspace
LEVELSET_RODIN_DIR=/path/to/workspace/rodin
LEVELSET_BUILD_DIR=/path/to/workspace/rodin/build
LEVELSET_EXPORT_SCRIPT=/path/to/levelset-console/scripts/export_obstacle_animation.sh
LEVELSET_EXPERIMENTS_DIR=/path/to/levelset-console/runs/experiments
LEVELSET_PETSC_DIR=/usr/local/ff-petsc/r
LEVELSET_JOBS=8
```

Meaning:

- `LEVELSET_RODIN_DIR`
  Root directory of the `rodin` source tree.
- `LEVELSET_BUILD_DIR`
  Build directory for `rodin`.
- `LEVELSET_EXPORT_SCRIPT`
  Animation export script path. By default this points to `scripts/export_obstacle_animation.sh` inside this repository.
- `LEVELSET_EXPERIMENTS_DIR`
  Experiment output directory. By default this points to `runs/experiments/` inside this repository.
- `LEVELSET_PETSC_DIR`
  PETSc path passed to `cmake`.
- `LEVELSET_JOBS`
  Build parallelism.

## Running

Start both frontend and backend:

```bash
cd levelset-console
./run.sh
```

Default addresses:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`

Start only the backend:

```bash
cd levelset-console/backend
./run.sh
```

Start only the frontend:

```bash
cd levelset-console/frontend
./run.sh
```

## Experiment Outputs

By default, experiments are written to:

```text
levelset-console/runs/experiments/
```

Each experiment stores:

- `config.json`
- `meta.json`
- `run.log`
- `obj.txt` / `obj_raw.txt`
- history files such as `vol.txt`, `al.txt`, and `ns.txt`
- `out/*.xdmf`
- `out/preview-*.mp4`
- `out/final-*.mp4`
