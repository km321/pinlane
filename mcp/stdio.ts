#!/usr/bin/env node
/**
 * Local stdio MCP bridge for Pinlane.
 * Env: PINLANE_URL (default http://127.0.0.1:3456), PINLANE_API_KEY
 */
import { createInterface } from "readline";

const baseUrl = (process.env.PINLANE_URL || "http://127.0.0.1:3456").replace(
  /\/$/,
  "",
);
const apiKey = process.env.PINLANE_API_KEY;

if (!apiKey) {
  console.error("PINLANE_API_KEY is required");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, terminal: false });

async function forward(message: unknown) {
  const res = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(message),
  });

  if (res.status === 204) return null;
  return res.json();
}

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const message = JSON.parse(trimmed);
    const response = await forward(message);
    if (response) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "bridge error";
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message },
      })}\n`,
    );
  }
});
