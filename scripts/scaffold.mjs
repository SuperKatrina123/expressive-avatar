#!/usr/bin/env node
import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const destinationArg = process.argv[2];
if (!destinationArg) {
  console.error("Usage: node scaffold.mjs /absolute/absent/destination");
  process.exit(2);
}
const destination = path.resolve(destinationArg);
try {
  await access(destination);
  console.error(`Refusing to overwrite existing destination: ${destination}`);
  process.exit(1);
} catch {}

const here = path.dirname(fileURLToPath(import.meta.url));
const template = path.resolve(here, "../assets/template");
await mkdir(path.dirname(destination), { recursive: true });
await cp(template, destination, { recursive: true, errorOnExist: true });
console.log(JSON.stringify({ ok: true, destination, files: ["avatar.manifest.json", "expressive-avatar.js", "expressive-avatar.d.ts"] }, null, 2));
