#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const manifestPath = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  console.error("Usage: node validate-assets.mjs /absolute/path/avatar.manifest.json");
  process.exit(2);
}

const errors = [];
const warnings = [];
const allowedTriggers = new Set([
  "look-left", "look-right", "look-up", "look-down", "look-away",
  "glasses-lift", "glasses-release", "wonder", "intro-start", "intro-complete",
]);
const allowedFixedActions = new Set([
  "question-marks", "glasses:lift", "glasses:return", "intro:play", "intro:finish-fast",
]);

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function pngInfo(buffer, label) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    errors.push(`${label}: expected PNG signature`);
    return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer[25];
  return { width, height, alpha: colorType === 4 || colorType === 6 };
}

function svgInfo(text, label) {
  const viewBox = text.match(/<svg[^>]*\bviewBox=["']([^"']+)["']/i)?.[1];
  if (!viewBox) errors.push(`${label}: SVG requires viewBox`);
  const paths = [...text.matchAll(/<path\b/gi)].length;
  if (!paths) errors.push(`${label}: SVG requires at least one path`);
  return { viewBox, paths };
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.error(`Cannot read manifest: ${error.message}`);
  process.exit(2);
}

const root = path.dirname(manifestPath);
assert(manifest.version === 1, "version must be 1");
assert(manifest.mode === "basic" || manifest.mode === "mesh", "mode must be basic or mesh");
assert(Number.isInteger(manifest.canvas?.width) && manifest.canvas.width > 0, "canvas.width must be a positive integer");
assert(Number.isInteger(manifest.canvas?.height) && manifest.canvas.height > 0, "canvas.height must be a positive integer");
assert(typeof manifest.poses?.rest === "string", "poses.rest is required");
assert(typeof manifest.intro?.outline === "string", "intro.outline is required");
assert(typeof manifest.intro?.paint === "string", "intro.paint is required");

const poseNames = new Set(Object.keys(manifest.poses ?? {}));
for (const [index, rule] of (manifest.rules ?? []).entries()) {
  assert(allowedTriggers.has(rule.when), `rules[${index}].when is unsupported: ${rule.when}`);
  assert(Array.isArray(rule.do) && rule.do.length > 0, `rules[${index}].do must be non-empty`);
  for (const action of rule.do ?? []) {
    if (action.startsWith("pose:")) {
      const pose = action.slice(5);
      assert(poseNames.has(pose), `rules[${index}] references missing pose: ${pose}`);
    } else {
      assert(allowedFixedActions.has(action), `rules[${index}] action is unsupported: ${action}`);
    }
  }
}

const poseInfos = [];
for (const [name, relative] of Object.entries(manifest.poses ?? {})) {
  const file = path.resolve(root, relative);
  try {
    const info = pngInfo(await readFile(file), `poses.${name}`);
    if (info) poseInfos.push({ name, file, ...info });
  } catch (error) {
    errors.push(`poses.${name}: cannot read ${file}: ${error.message}`);
  }
}

for (const pose of poseInfos) {
  assert(pose.width === manifest.canvas.width && pose.height === manifest.canvas.height,
    `poses.${pose.name}: ${pose.width}x${pose.height} does not match canvas ${manifest.canvas.width}x${manifest.canvas.height}`);
  if (!pose.alpha && manifest.appearance?.background === "transparent") {
    warnings.push(`poses.${pose.name}: PNG has no alpha channel but background is transparent`);
  }
}

let outlineInfo;
let paintInfo;
for (const [label, relative] of [["intro.outline", manifest.intro?.outline], ["intro.paint", manifest.intro?.paint]]) {
  if (!relative) continue;
  const file = path.resolve(root, relative);
  try {
    const info = svgInfo(await readFile(file, "utf8"), label);
    if (label === "intro.outline") outlineInfo = info; else paintInfo = info;
  } catch (error) {
    errors.push(`${label}: cannot read ${file}: ${error.message}`);
  }
}
const expectedViewBox = `0 0 ${manifest.canvas?.width} ${manifest.canvas?.height}`;
if (outlineInfo?.viewBox) assert(outlineInfo.viewBox.trim().replace(/\s+/g, " ") === expectedViewBox, `intro.outline viewBox must be ${expectedViewBox}`);
if (paintInfo?.viewBox) assert(paintInfo.viewBox.trim().replace(/\s+/g, " ") === expectedViewBox, `intro.paint viewBox must be ${expectedViewBox}`);

const glasses = manifest.glasses;
assert(glasses && glasses.left && glasses.right, "glasses.left and glasses.right are required");
for (const side of ["left", "right"]) {
  const lens = glasses?.[side];
  if (!lens) continue;
  for (const key of ["cx", "cy", "r"]) assert(Number.isFinite(lens[key]), `glasses.${side}.${key} must be numeric`);
  if (Number.isFinite(lens.cx) && Number.isFinite(lens.cy) && Number.isFinite(lens.r)) {
    assert(lens.cx - lens.r >= 0 && lens.cx + lens.r <= manifest.canvas.width, `glasses.${side} exceeds horizontal canvas bounds`);
    assert(lens.cy - lens.r >= 0 && lens.cy + lens.r <= manifest.canvas.height, `glasses.${side} exceeds vertical canvas bounds`);
  }
}
assert(typeof glasses?.bridgePath === "string" && glasses.bridgePath.length > 0, "glasses.bridgePath is required");
assert(Array.isArray(glasses?.origin) && glasses.origin.length === 2, "glasses.origin must be [x,y]");

for (const [index, mark] of (manifest.wonder?.marks ?? []).entries()) {
  assert(typeof mark.path === "string" && mark.path.length > 0, `wonder.marks[${index}].path is required`);
  assert(Array.isArray(mark.dot) && mark.dot.length === 2 && mark.dot.every(Number.isFinite), `wonder.marks[${index}].dot must be [x,y]`);
}
if ((manifest.wonder?.marks ?? []).length === 0) warnings.push("No question marks configured");
if (manifest.mode === "mesh") warnings.push("mesh mode requires a project-specific renderer and mesh.json validation");

const report = {
  ok: errors.length === 0,
  manifest: manifestPath,
  poses: poseInfos.map(({ name, width, height, alpha }) => ({ name, width, height, alpha })),
  outlinePaths: outlineInfo?.paths ?? 0,
  paintPaths: paintInfo?.paths ?? 0,
  rules: (manifest.rules ?? []).length,
  errors,
  warnings,
};
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);
