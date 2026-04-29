from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import app


class MeshSceneTests(unittest.TestCase):
    def write_mesh(self, directory: Path) -> Path:
        mesh_path = directory / "Omega.7.mesh"
        mesh_path.write_text(
            "\n".join(
                [
                    "MeshVersionFormatted 2",
                    "Dimension 3",
                    "Vertices",
                    "5",
                    "0 0 0 0",
                    "1 0 0 0",
                    "0 1 0 0",
                    "0 0 1 0",
                    "0 0 -1 0",
                    "Tetrahedra",
                    "2",
                    "1 2 3 4 2",
                    "1 2 3 5 3",
                    "End",
                ]
            ),
            encoding="utf-8",
        )
        return mesh_path

    def test_medit_scene_includes_obstacle_interface_and_domain_exterior(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            mesh_path = self.write_mesh(Path(tmp))

            scene = app.parse_medit_scene_polydata(mesh_path)

        self.assertEqual(scene["source"], "Omega.7.mesh")
        self.assertEqual(scene["obstacle"]["selection_mode"], "tet-interface")
        self.assertEqual(scene["obstacle"]["triangle_count"], 1)
        self.assertEqual(scene["domain"]["selection_mode"], "tet-exterior")
        self.assertEqual(scene["domain"]["triangle_count"], 6)
        self.assertEqual(scene["domain"]["point_count"], 5)
        self.assertEqual(scene["domain"]["bounds"], [0.0, 1.0, 0.0, 1.0, -1.0, 1.0])
        self.assertEqual(scene["velocity"]["count"], 0)

    def test_mesh_name_selects_matching_or_latest_timestep(self) -> None:
        self.assertEqual(app.mesh_timestep_index("Omega.7.mesh", latest_timestep=12), 7)
        self.assertEqual(app.mesh_timestep_index("Omega.final.mesh", latest_timestep=12), 12)
        self.assertEqual(app.mesh_timestep_index("Omega.final.postsmooth.mesh", latest_timestep=12), 12)
        self.assertEqual(app.mesh_timestep_index("Omega.postsmooth.mesh", latest_timestep=12), 12)


if __name__ == "__main__":
    unittest.main()
