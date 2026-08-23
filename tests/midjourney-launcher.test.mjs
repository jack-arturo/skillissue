import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preflight = path.join(root, "skills", "midjourney-iteration", "bin", "preflight");
const relaunch = path.join(root, "skills", "midjourney-iteration", "bin", "relaunch-chrome");

test("Midjourney preflight delegates unavailable CDP to the launcher mode", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "skillissue-midjourney-launcher-"));
  const bin = path.join(fixture, "bin");
  const log = path.join(fixture, "launcher.log");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "dev-browser"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "curl"), "#!/bin/sh\nexit 22\n", { mode: 0o755 });
  fs.writeFileSync(
    path.join(bin, "relaunch-chrome"),
    "#!/bin/sh\nprintf '%s\\n' \"$MJ_ITER_BROWSER_MODE\" >> \"$MJ_ITER_TEST_LOG\"\n",
    { mode: 0o755 },
  );

  try {
    for (const mode of ["prompt", "never", "always"]) {
      const result = spawnSync(preflight, [], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          MJ_ITER_BROWSER_MODE: mode,
          MJ_ITER_SKILL_ROOT: fixture,
          MJ_ITER_TEST_LOG: log,
        },
      });
      assert.notEqual(result.status, 0, "CDP remains unavailable in the fixture");
    }
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), ["prompt", "never", "always"]);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("documented Midjourney launcher is directly executable", () => {
  assert.notEqual(fs.statSync(relaunch).mode & 0o111, 0);
});
