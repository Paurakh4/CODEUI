import { spawn } from "node:child_process"
import { createRequire } from "node:module"

process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA ??= "true"

const require = createRequire(import.meta.url)
const nextArgs = process.argv.slice(2)
const nextBinPath = require.resolve("next/dist/bin/next")
const warningFilterPath = require.resolve("./suppress-baseline-warning.cjs")

const child = spawn(process.execPath, ["--require", warningFilterPath, nextBinPath, ...nextArgs], {
  env: process.env,
  stdio: "inherit",
})

child.on("error", (error) => {
  console.error("Failed to start Next.js:", error)
  process.exit(1)
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})