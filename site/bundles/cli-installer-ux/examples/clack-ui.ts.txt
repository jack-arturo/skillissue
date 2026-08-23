import { spinner } from "@clack/prompts";

export type Theme = {
  color: boolean;
  unicode: boolean;
  check: string;
  warn: string;
  bullet: string;
};

export function makeTheme(stream: NodeJS.WriteStream = process.stdout): Theme {
  const color = stream.isTTY === true && !process.env.NO_COLOR;
  const unicode = stream.isTTY === true && process.env.TERM !== "dumb" && process.env.APP_ASCII !== "1";
  return {
    color,
    unicode,
    check: unicode ? "✓" : "+",
    warn: unicode ? "▲" : "!",
    bullet: unicode ? "•" : "-"
  };
}

export function writeJson(value: unknown, stream: NodeJS.WriteStream = process.stdout): void {
  stream.write(`${JSON.stringify(value, null, 2) ?? "null"}\n`);
}

export function startTask(label: string, stream: NodeJS.WriteStream = process.stdout) {
  if (stream.isTTY !== true) {
    stream.write(`${label}\n`);
    return { stop: (message: string) => stream.write(`${message}\n`), error: (message: string) => process.stderr.write(`${message}\n`) };
  }
  const spin = spinner({ output: stream, withGuide: false });
  spin.start(label);
  return { stop: (message: string) => spin.stop(message), error: (message: string) => spin.error(message) };
}
