import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"

export async function GET() {
  const filePath = path.join(
    process.cwd(),
    "lib",
    "templates",
    "default-canvas-preview.html"
  )

  const html = await readFile(filePath, "utf8")

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
