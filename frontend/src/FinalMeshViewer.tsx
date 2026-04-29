import { useEffect, useRef } from "react";
import "@kitware/vtk.js/Rendering/Profiles/Geometry";
import "@kitware/vtk.js/Rendering/Profiles/Glyph";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkPolyData from "@kitware/vtk.js/Common/DataModel/PolyData";
import vtkArrowSource from "@kitware/vtk.js/Filters/Sources/ArrowSource";
import vtkOrientationMarkerWidget from "@kitware/vtk.js/Interaction/Widgets/OrientationMarkerWidget";
import { Corners } from "@kitware/vtk.js/Interaction/Widgets/OrientationMarkerWidget/Constants";
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
import vtkAxesActor from "@kitware/vtk.js/Rendering/Core/AxesActor";
import vtkGlyph3DMapper from "@kitware/vtk.js/Rendering/Core/Glyph3DMapper";
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";
import vtkGenericRenderWindow from "@kitware/vtk.js/Rendering/Misc/GenericRenderWindow";
import type { FinalMeshData, MeshPolyData, VelocitySampleData } from "./types";

type Props = {
  mesh: FinalMeshData;
};

type SurfaceStyle = {
  color: [number, number, number];
  edgeColor: [number, number, number];
  opacity: number;
  lineWidth: number;
  specular?: number;
};

function polyDataFromSurface(surface: MeshPolyData): ReturnType<typeof vtkPolyData.newInstance> {
  const polyData = vtkPolyData.newInstance();
  polyData.getPoints().setData(Float32Array.from(surface.points), 3);
  polyData.getPolys().setData(Uint32Array.from(surface.polys));
  return polyData;
}

function addSurfaceActor(
  renderer: ReturnType<ReturnType<typeof vtkGenericRenderWindow.newInstance>["getRenderer"]>,
  surface: MeshPolyData | undefined,
  style: SurfaceStyle
) {
  if (!surface?.points.length || !surface.polys.length) {
    return null;
  }

  const polyData = polyDataFromSurface(surface);
  const mapper = vtkMapper.newInstance();
  mapper.setInputData(polyData);

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  const property = actor.getProperty();
  property.setColor(...style.color);
  property.setOpacity(style.opacity);
  property.setAmbient(0.18);
  property.setDiffuse(0.82);
  property.setSpecular(style.specular ?? 0.05);
  property.setSpecularPower(18);
  property.setEdgeVisibility(true);
  property.setEdgeColor(...style.edgeColor);
  property.setLineWidth(style.lineWidth);

  renderer.addActor(actor);
  return { actor, mapper, polyData };
}

function combinedBounds(mesh: FinalMeshData): number[] | undefined {
  return mesh.domain?.bounds ?? mesh.obstacle?.bounds;
}

function maxSpan(bounds: number[] | undefined): number {
  if (!bounds || bounds.length < 6) {
    return 1;
  }
  return Math.max(bounds[1] - bounds[0], bounds[3] - bounds[2], bounds[5] - bounds[4], 1e-6);
}

function addVelocityActor(
  renderer: ReturnType<ReturnType<typeof vtkGenericRenderWindow.newInstance>["getRenderer"]>,
  velocity: VelocitySampleData | undefined,
  bounds: number[] | undefined
) {
  if (!velocity?.count || !velocity.positions.length || !velocity.vectors.length || velocity.max_magnitude <= 0) {
    return null;
  }

  const polyData = vtkPolyData.newInstance();
  polyData.getPoints().setData(Float32Array.from(velocity.positions), 3);
  const vectorArray = vtkDataArray.newInstance({
    name: "velocity",
    numberOfComponents: 3,
    values: Float32Array.from(velocity.vectors),
  });
  polyData.getPointData().addArray(vectorArray);
  polyData.getPointData().setVectors(vectorArray);

  const arrow = vtkArrowSource.newInstance({
    tipResolution: 12,
    tipRadius: 0.08,
    tipLength: 0.28,
    shaftResolution: 8,
    shaftRadius: 0.025,
  });
  const mapper = vtkGlyph3DMapper.newInstance({
    orient: true,
    orientationArray: "velocity",
    orientationMode: vtkGlyph3DMapper.OrientationModes.DIRECTION,
    scaling: true,
    scaleArray: "velocity",
    scaleMode: vtkGlyph3DMapper.ScaleModes.SCALE_BY_MAGNITUDE,
    scaleFactor: (maxSpan(bounds) * 0.12) / velocity.max_magnitude,
  });
  mapper.setInputData(polyData, 0);
  mapper.setSourceConnection(arrow.getOutputPort());

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  const property = actor.getProperty();
  property.setColor(0.72, 0.02, 0.08);
  property.setAmbient(0.25);
  property.setDiffuse(0.85);
  property.setSpecular(0.18);
  property.setSpecularPower(12);

  renderer.addActor(actor);
  return { actor, mapper, polyData, arrow };
}

export default function FinalMeshViewer({ mesh }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const genericRenderWindow = vtkGenericRenderWindow.newInstance();
    genericRenderWindow.setContainer(container);

    const renderer = genericRenderWindow.getRenderer();
    const renderWindow = genericRenderWindow.getRenderWindow();
    renderer.setBackground(0.34, 0.36, 0.47);

    const bounds = combinedBounds(mesh);
    const domain = addSurfaceActor(renderer, mesh.domain, {
      color: [0.42, 0.36, 0.56],
      edgeColor: [0.20, 0.23, 0.34],
      opacity: 0.22,
      lineWidth: 0.7,
    });
    const obstacle = addSurfaceActor(renderer, mesh.obstacle ?? mesh, {
      color: [0.58, 0.51, 0.42],
      edgeColor: [0.04, 0.04, 0.05],
      opacity: 1.0,
      lineWidth: 1.0,
      specular: 0.1,
    });
    const velocity = addVelocityActor(renderer, mesh.velocity, bounds);

    const axes = vtkAxesActor.newInstance();
    const orientationWidget = vtkOrientationMarkerWidget.newInstance({
      actor: axes,
      interactor: genericRenderWindow.getInteractor(),
      parentRenderer: renderer,
    });
    orientationWidget.setViewportCorner(Corners.BOTTOM_LEFT);
    orientationWidget.setViewportSize(0.16);
    orientationWidget.setMinPixelSize(72);
    orientationWidget.setMaxPixelSize(132);
    orientationWidget.setEnabled(true);

    renderer.resetCamera();
    genericRenderWindow.resize();
    renderWindow.render();

    const onResize = () => {
      genericRenderWindow.resize();
      orientationWidget.updateViewport();
      renderWindow.render();
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      orientationWidget.setEnabled(false);
      orientationWidget.delete();
      axes.delete();
      for (const resource of [velocity, obstacle, domain]) {
        if (!resource) continue;
        renderer.removeActor(resource.actor);
        resource.actor.delete();
        resource.mapper.delete();
        resource.polyData.delete();
        const arrow = (resource as { arrow?: { delete: () => void } }).arrow;
        arrow?.delete();
      }
      genericRenderWindow.delete();
    };
  }, [mesh]);

  return (
    <div className="mesh-viewer-canvas" ref={containerRef}>
      <div className="mesh-axis-labels" aria-hidden="true">
        <span className="axis-label axis-label-x">X</span>
        <span className="axis-label axis-label-y">Y</span>
        <span className="axis-label axis-label-z">Z</span>
      </div>
    </div>
  );
}
