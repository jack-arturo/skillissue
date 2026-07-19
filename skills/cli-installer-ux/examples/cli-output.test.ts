import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["dist/cli.js", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

describe("CLI public output", () => {
  it("keeps JSON mode parseable and notice-free", async () => {
    const result = await runCli(["status", "--json"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(result.stdout).not.toContain("Update available");
  });

  it("keeps human success output free of debug diagnostics", async () => {
    const result = await runCli(["status"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain('{"level"');
    expect(result.stdout).not.toContain("stack trace");
  });
});
