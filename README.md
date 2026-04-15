# LevelSetStokes Console

本地实验控制台，面向 `Rodin` 中的 `examples/PETSc/LevelSetStokes` 例子。

它提供：

- React + Vite 前端
- FastAPI 后端
- 单任务实验管理
- 历史实验目录
- 预览动画和最终动画导出

## 仓库结构

- `backend/`
  FastAPI 服务，负责构建 target、启动求解、管理实验和导出动画。
- `frontend/`
  React 单页应用。
- `run.sh`
  一键同时启动前后端。

## 运行依赖

### Python

后端只依赖：

- `fastapi`
- `uvicorn`

安装方式：

```bash
cd levelset-console/backend
python3 -m venv ../.venv
../.venv/bin/pip install -r requirements.txt
```

### Node.js

前端依赖：

- `react`
- `react-dom`
- `recharts`
- `vite`
- `typescript`

安装方式：

```bash
cd levelset-console/frontend
npm install
```

### 系统工具

后端运行实验和导出动画还依赖：

- `cmake`
- 可用的 C++/MPI/PETSc 构建环境
- `pvpython`（ParaView）
- `ffmpeg`

## 与 Rodin 的关系

这个控制台不是纯前端示例，它需要实际调用 `Rodin` 的 `LevelSetStokes` 可执行文件。

默认假设目录结构是：

```text
<workspace>/
  rodin/
  levelset-console/
    scripts/export_obstacle_animation.sh
    runs/experiments/
```

也就是说，这个控制台现在默认只把自己的父目录当成工作区根目录，用来定位 `rodin/`。
动画脚本和实验历史目录已经收进了 `levelset-console` 自己内部。

如果你的目录结构不同，可以用环境变量覆盖。

## 可配置环境变量

可以在仓库根目录创建 `.env` 文件，或者在 shell 中直接导出：

```bash
LEVELSET_STAGE_DIR=/path/to/workspace
LEVELSET_RODIN_DIR=/path/to/workspace/rodin
LEVELSET_BUILD_DIR=/path/to/workspace/rodin/build
LEVELSET_EXPORT_SCRIPT=/path/to/levelset-console/scripts/export_obstacle_animation.sh
LEVELSET_EXPERIMENTS_DIR=/path/to/levelset-console/runs/experiments
LEVELSET_PETSC_DIR=/usr/local/ff-petsc/r
LEVELSET_JOBS=8
```

说明：

- `LEVELSET_RODIN_DIR`
  `rodin` 源码根目录。
- `LEVELSET_BUILD_DIR`
  `rodin` 的构建目录。
- `LEVELSET_EXPORT_SCRIPT`
  动画导出脚本路径。默认使用仓库内的 `scripts/export_obstacle_animation.sh`。
- `LEVELSET_EXPERIMENTS_DIR`
  历史实验输出目录。默认使用仓库内的 `runs/experiments/`。
- `LEVELSET_PETSC_DIR`
  传给 `cmake` 的 PETSc 路径。
- `LEVELSET_JOBS`
  构建并行度。

## 启动

一键启动：

```bash
cd levelset-console
./run.sh
```

默认地址：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:8000`

单独启动后端：

```bash
cd levelset-console/backend
./run.sh
```

单独启动前端：

```bash
cd levelset-console/frontend
./run.sh
```

## 实验输出

实验目录默认写到：

```text
levelset-console/runs/experiments/
```

每次实验会保存：

- `config.json`
- `meta.json`
- `run.log`
- `obj.txt` / `obj_raw.txt`
- `vol.txt` / `al.txt` / `ns.txt` 等历史文件
- `out/*.xdmf`
- `out/preview-*.mp4`
- `out/final-*.mp4`

## 开源建议

这个目录适合单独开源，但建议不要提交下面这些内容：

- `.venv/`
- `frontend/node_modules/`
- `frontend/dist/`
- `backend/__pycache__/`
- 本地产生的实验输出目录

如果你把它作为独立仓库发布，建议同时说明：

- 它依赖 `Rodin` 的 `LevelSetStokes` examples
- 动画脚本已经内置在 `scripts/`
- 需要 `pvpython` 和 `ffmpeg`
