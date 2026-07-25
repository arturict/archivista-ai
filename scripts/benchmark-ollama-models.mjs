#!/usr/bin/env node

import {
  parseBenchmarkArguments,
  runBenchmark,
  writeBenchmarkArtifacts
} from './ollama-benchmark-harness-lib.mjs';

const usage = `Tagvico Ollama benchmark

Usage:
  node scripts/benchmark-ollama-models.mjs --models gemma4:e2b,gemma4:e4b [options]

Options:
  --base-url <url>       Ollama URL (default: http://127.0.0.1:11434)
  --models <ids>         Comma-separated model IDs (required)
  --repetitions <n>      Runs per fixture, 1-20 (default: 1)
  --suite <name>         all, structured, or tools (default: all)
  --timeout-ms <ms>      Per-request timeout (default: 180000)
  --output-dir <path>    Ignored result root (default: .local/benchmarks/ollama)
  --help                 Show this help
`;

try {
  const options = parseBenchmarkArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    process.exitCode = 0;
  } else {
    const report = await runBenchmark({
      ...options,
      onProgress: (message) => process.stderr.write(`${message}\n`)
    });
    const artifacts = await writeBenchmarkArtifacts({
      report,
      outputDir: options.outputDir
    });
    process.stdout.write(`${JSON.stringify(artifacts, null, 2)}\n`);
    process.exitCode = report.models.some((entry) => entry.summary.failedProbes > 0) ? 2 : 0;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}`);
  process.exitCode = 1;
}
