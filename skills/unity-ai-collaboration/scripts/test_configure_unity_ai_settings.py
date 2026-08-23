#!/usr/bin/env python3

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/configure-unity-ai-settings"
BASELINE = ROOT / "references/unity-ai-settings-baseline.json"


class ConfigureUnityAiSettingsTests(unittest.TestCase):
    def make_project(self, root: Path) -> Path:
        project = root / "QuestProject"
        (project / "ProjectSettings").mkdir(parents=True)
        (project / "Packages").mkdir()
        (project / "ProjectSettings/ProjectVersion.txt").write_text(
            "m_EditorVersion: 6000.3.18f1\n", encoding="utf-8"
        )
        (project / "Packages/manifest.json").write_text(
            '{"dependencies":{}}\n', encoding="utf-8"
        )
        return project

    def make_fake_cli(self, root: Path, values: dict[str, object]) -> Path:
        fake = root / "unity-mcp-cli"
        payload = ";".join(
            f"{key}={str(value).lower() if isinstance(value, bool) else value}"
            for key, value in values.items()
        )
        response = {
            "status": "success",
            "structured": {
                "result": {"name": "result", "typeName": "System.String", "value": payload}
            },
        }
        fake.write_text(
            "#!/bin/sh\n"
            "if [ -n \"$UNITY_AI_SETTINGS_CAPTURE\" ]; then cat > \"$UNITY_AI_SETTINGS_CAPTURE\"; else cat >/dev/null; fi\n"
            f"printf '%s\\n' '{json.dumps(response, separators=(',', ':'))}'\n",
            encoding="utf-8",
        )
        fake.chmod(0o755)
        return fake

    def run_script(self, project: Path, fake: Path, *extra: str, env_extra=None):
        env = os.environ.copy()
        env["UNITY_MCP_CLI"] = str(fake)
        if env_extra:
            env.update(env_extra)
        return subprocess.run(
            [str(SCRIPT), "--project", str(project), "--baseline", str(BASELINE), "--json", *extra],
            check=False,
            capture_output=True,
            text=True,
            env=env,
        )

    def test_audit_reports_drift_without_exposing_protected_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            project = self.make_project(root)
            fake = self.make_fake_cli(
                root,
                {
                    "assistant.auto_run": True,
                    "assistant.third_party_tools": 0,
                    "assistant.read_external_files": 0,
                    "assistant.modify_project": 0,
                    "assistant.asset_generation": 0,
                },
            )
            result = self.run_script(project, fake)

        self.assertEqual(1, result.returncode)
        report = json.loads(result.stdout)
        self.assertFalse(report["compliant"])
        self.assertGreater(len(report["drift"]), 0)
        self.assertNotIn("token", result.stdout.lower())
        self.assertNotIn("credential", result.stdout.lower())

    def test_apply_emits_editorprefs_writes_only_after_explicit_flag(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            project = self.make_project(root)
            baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
            values = {item["id"]: item["value"] for item in baseline["settings"]}
            fake = self.make_fake_cli(root, values)
            capture = root / "input.json"
            result = self.run_script(
                project,
                fake,
                "--apply",
                env_extra={"UNITY_AI_SETTINGS_CAPTURE": str(capture)},
            )
            self.assertEqual(0, result.returncode, result.stderr)
            request = json.loads(capture.read_text(encoding="utf-8"))
            code = request["csharpCode"]
            self.assertIn("EditorPrefs.SetBool", code)
            self.assertIn("EditorPrefs.SetInt", code)
            self.assertNotIn("AccessToken", code)
            self.assertNotIn("DisclaimerAccepted", code)

    def test_rejects_baseline_that_mentions_a_protected_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            project = self.make_project(root)
            fake = self.make_fake_cli(root, {})
            bad = root / "bad.json"
            bad.write_text(
                json.dumps(
                    {
                        "schema_version": 1,
                        "settings": [
                            {
                                "id": "meta.access_token",
                                "editor_prefs_key": "Meta.XR.SDK.AI Agent Bridge.RemoteServer_AccessToken",
                                "type": "string",
                                "value": "secret",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["UNITY_MCP_CLI"] = str(fake)
            result = subprocess.run(
                [str(SCRIPT), "--project", str(project), "--baseline", str(bad), "--json"],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )

        self.assertEqual(2, result.returncode)
        self.assertIn("protected", result.stderr.lower())


if __name__ == "__main__":
    unittest.main()
