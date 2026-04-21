import { useEffect, useRef } from "react";
import "@kitware/vtk.js/Rendering/Profiles/Geometry";
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";
import vtkGenericRenderWindow from "@kitware/vtk.js/Rendering/Misc/GenericRenderWindow";
import vtkPolyData from "@kitware/vtk.js/Common/DataModel/PolyData";
import type { FinalMeshData } from "./types";

type Props = {
  mesh: FinalMeshData;
};

export default function FinalMeshViewer({ mesh }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const genericRenderWindow = vtkGenericRenderWindow.newInstance();
    genericRenderWindow.setContainer(container);

    const renderer = genericRenderWindow.getRenderer();
    const renderWindow = genericRenderWindow.getRenderWindow();
    renderer.setBackground(0.95, 0.97, 1.0);

    const polyData = vtkPolyData.newInstance();
    polyData.getPoints().setData(Float32Array.from(mesh.points), 3);
    polyData.getPolys().setData(Uint32Array.from(mesh.polys));

    const mapper = vtkMapper.newInstance();
    mapper.setInputData(polyData);

    const actor = vtkActor.newInstance();
    actor.setMapper(mapper);
    const property = actor.getProperty();
    property.setColor(0.20, 0.33, 0.72);
    property.setAmbient(0.2);
    property.setDiffuse(0.8);
    property.setSpecular(0.08);
    property.setSpecularPower(20);
    property.setEdgeVisibility(true);
    property.setEdgeColor(0.06, 0.10, 0.20);
    property.setLineWidth(1.0);

    renderer.addActor(actor);
    renderer.resetCamera();
    genericRenderWindow.resize();
    renderWindow.render();

    const onResize = () => {
      genericRenderWindow.resize();
      renderWindow.render();
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      renderer.removeActor(actor);
      actor.delete();
      mapper.delete();
      polyData.delete();
      genericRenderWindow.delete();
    };
  }, [mesh]);

  return <div className="mesh-viewer-canvas" ref={containerRef} />;
}
