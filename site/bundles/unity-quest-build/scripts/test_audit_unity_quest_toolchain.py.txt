#!/usr/bin/env python3

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("audit-unity-quest-toolchain")


class AuditUnityQuestToolchainTests(unittest.TestCase):
    def test_reports_fixture_project_without_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp)
            (project / "ProjectSettings").mkdir()
            (project / "Packages").mkdir()
            (project / "ProjectSettings/ProjectVersion.txt").write_text(
                "m_EditorVersion: 6000.3.18f1\n", encoding="utf-8"
            )
            (project / "ProjectSettings/ProjectSettings.asset").write_text(
                "  cloudProjectId: fixture-cloud-project\n"
                "  organizationId: fixture-organization\n",
                encoding="utf-8",
            )
            (project / "Packages/manifest.json").write_text(
                json.dumps({"dependencies": {"com.unity.xr.openxr": "1.17.1"}}),
                encoding="utf-8",
            )
            (project / "Packages/packages-lock.json").write_text(
                json.dumps({"dependencies": {"com.unity.xr.openxr": {"version": "1.16.0"}}}),
                encoding="utf-8",
            )
            for wrapper_root in (".agents/skills", ".claude/skills"):
                skill = project / wrapper_root / "ping/SKILL.md"
                skill.parent.mkdir(parents=True)
                skill.write_text("# Ping\n", encoding="utf-8")
            licensing_client = project / "fake-unity-licensing-client"
            licensing_client.write_text(
                "#!/bin/sh\n"
                "printf '%s\\n' 'Product Name: Unity Pro' 'License Type: Assigned'\n",
                encoding="utf-8",
            )
            licensing_client.chmod(0o755)
            server_root = project / "Library/mcp-server/osx-arm64"
            server_root.mkdir(parents=True)
            server = server_root / "gamedev-mcp-server"
            execution_marker = project / "server-was-executed"
            server.write_text(
                "#!/bin/sh\n"
                f"touch {execution_marker!s}\n"
                "printf '%s\\n' WRONG\n",
                encoding="utf-8",
            )
            server.chmod(0o755)
            (server_root / "version").write_text("9.0.0\n", encoding="utf-8")
            before = sorted(str(path.relative_to(project)) for path in project.rglob("*"))
            environment = os.environ.copy()
            environment["UNITY_LICENSING_CLIENT"] = str(licensing_client)
            result = subprocess.run(
                [str(SCRIPT), "--project", str(project), "--json", "--offline"],
                check=True,
                capture_output=True,
                text=True,
                env=environment,
            )
            data = json.loads(result.stdout)
            after = sorted(str(path.relative_to(project)) for path in project.rglob("*"))
            self.assertEqual(data["editor"]["pinned"], "6000.3.18f1")
            self.assertEqual(
                data["project_link"],
                {
                    "cloud_project_id": "fixture-cloud-project",
                    "organization_id": "fixture-organization",
                    "linked": True,
                },
            )
            self.assertEqual(data["packages"]["com.unity.xr.openxr"], "1.17.1")
            self.assertEqual(data["resolved_packages"]["com.unity.xr.openxr"], "1.16.0")
            self.assertIn("com.unity.xr.openxr", data["package_resolution_drift"])
            self.assertIn("cli_version", data["ivan_mcp"])
            self.assertIn("server_path", data["ivan_mcp"])
            self.assertEqual(data["ivan_mcp"]["server_version"], "9.0.0")
            self.assertFalse(execution_marker.exists())
            wrappers = data["generated_wrappers"]
            self.assertEqual(wrappers[0]["count"], 1)
            self.assertEqual(wrappers[0]["sha256"], wrappers[1]["sha256"])
            self.assertEqual(data["unity_license"]["products"], ["Unity Pro"])
            self.assertEqual(
                data["unity_license"]["scope"],
                "local_editor_entitlements_only",
            )
            self.assertTrue(data["unity_license"]["paid_editor_product_active"])
            self.assertNotIn("paid_seat_active", data["unity_license"])
            self.assertEqual(before, after)

    def test_rejects_non_unity_directory(self):
        with tempfile.TemporaryDirectory() as temp:
            result = subprocess.run(
                [str(SCRIPT), "--project", temp, "--json", "--offline"],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 2)
            self.assertIn("not a Unity project", result.stderr)


if __name__ == "__main__":
    unittest.main()
