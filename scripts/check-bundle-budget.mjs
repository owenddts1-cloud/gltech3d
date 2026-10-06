#!/usr/bin/env node
/**
 * Bundle budget gate (EPIC-12 §S-12.05, pendência 6).
 *
 * For each route in `perf-budgets.json`, sums the gzip size of every JS chunk
 * the browser loads on a cold visit — the page entry plus every ancestor
 * layout / template / loading / error / not-found boundary, de-duplicated —
 * read from `.next/app-build-manifest.json`, and fails when a route exceeds
 * its `maxGzipKB`.
 *
 * Usage (after `next build`):
 *   node scripts/check-bundle-budget.mjs            # check, exit 1 on overrun
 *   node scripts/check-bundle-budget.mjs --print    # measure only, exit 0
 *   node scripts/check-bundle-budget.mjs --manifest .next/standalone/.next/app-build-manifest.json
 *
 * Exit codes: 0 ok · 1 budget overrun · 2 setup error (no build, dev-server
 * manifest, unknown route entry). A missing build is an ERROR, not a pass —
 * "did not run" must never read as "passed".
 *
 * Zero dependencies: node:fs + node:zlib only.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const opts = {
    nextDir: path.join(ROOT, ".next"),
    manifest: null,
    budgets: path.join(ROOT, "perf-budgets.json"),
    print: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (!v) fail(`missing value for ${a}`);
      return path.resolve(ROOT, v);
    };
    if (a === "--next-dir") opts.nextDir = next();
    else if (a === "--manifest") opts.manifest = next();
    else if (a === "--budgets") opts.budgets = next();
    else if (a === "--print") opts.print = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(
        "node scripts/check-bundle-budget.mjs [--print] [--next-dir .next] [--manifest <app-build-manifest.json>] [--budgets perf-budgets.json]\n",
      );
      process.exit(0);
    } else fail(`unknown argument: ${a}`);
  }
  opts.manifest ??= path.join(opts.nextDir, "app-build-manifest.json");
  return opts;
}

function fail(msg) {
  process.stderr.write(`[bundle-budget] ERROR: ${msg}\n`);
  process.exit(2);
}

function readJson(file, what) {
  if (!existsSync(file)) fail(`${what} not found at ${path.relative(ROOT, file)} — run \`next build\` first.`);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    fail(`${what} is not valid JSON (${err instanceof Error ? err.message : String(err)})`);
  }
}

const BOUNDARY_FILES = ["layout", "template", "loading", "error", "not-found"];

/**
 * Manifest keys that load on a cold visit to `entry` ("/app/(pro)/inbox/page"):
 * the entry itself + boundary files of every ancestor segment ("/", "/app",
 * "/app/(pro)", "/app/(pro)/inbox").
 */
function keysForEntry(pages, entry) {
  const segments = entry.split("/").filter(Boolean);
  segments.pop(); // drop "page"
  const keys = [entry];
  for (let depth = 0; depth <= segments.length; depth++) {
    const dir = "/" + segments.slice(0, depth).join("/");
    for (const leaf of BOUNDARY_FILES) {
      const key = dir === "/" ? `/${leaf}` : `${dir}/${leaf}`;
      if (pages[key]) keys.push(key);
    }
  }
  return keys;
}

const gzipCache = new Map();
function gzipBytes(absFile) {
  let size = gzipCache.get(absFile);
  if (size === undefined) {
    size = gzipSync(readFileSync(absFile), { level: 9 }).length;
    gzipCache.set(absFile, size);
  }
  return size;
}

function measure(pages, entry, baseDir) {
  if (!pages[entry]) {
    fail(`route entry "${entry}" is not in the manifest — fix perf-budgets.json (route renamed/moved?).`);
  }
  const files = new Set();
  for (const key of keysForEntry(pages, entry)) {
    for (const f of pages[key]) if (f.endsWith(".js")) files.add(f);
  }
  let total = 0;
  for (const rel of files) {
    const abs = path.join(baseDir, rel);
    if (!existsSync(abs)) {
      fail(`chunk ${rel} listed in the manifest is missing on disk — stale .next? Rebuild.`);
    }
    total += gzipBytes(abs);
  }
  return { bytes: total, chunks: files.size };
}

const kb = (bytes) => bytes / 1024;
const fmt = (n) => n.toFixed(1);

function table(rows) {
  const header = ["route", "entry", "chunks", "gzip KB", "budget KB", "used", "status"];
  const body = rows.map((r) => [
    r.route,
    r.entry,
    String(r.chunks),
    fmt(kb(r.bytes)),
    r.budgetKB === null ? "-" : fmt(r.budgetKB),
    r.budgetKB === null ? "-" : `${Math.round((kb(r.bytes) / r.budgetKB) * 100)}%`,
    r.status,
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [line(header), widths.map((w) => "-".repeat(w)).join("  "), ...body.map(line)].join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const budgets = readJson(opts.budgets, "perf-budgets.json");
  const manifest = readJson(opts.manifest, "app-build-manifest.json");
  const pages = manifest?.pages;
  if (!pages || typeof pages !== "object") fail("manifest has no `pages` map.");

  // A `next dev` run rewrites this manifest with unminified dev chunks; sizing
  // those would be meaningless (and much larger).
  const allFiles = Object.values(pages).flat();
  if (allFiles.some((f) => /development|next-devtools|turbopack-/.test(f))) {
    fail("manifest comes from a dev server (`next dev`), not a production build — run `next build`.");
  }

  // Chunk paths are relative to the .next dir that owns the manifest's static/.
  const baseDir = existsSync(path.join(path.dirname(opts.manifest), "static"))
    ? path.dirname(opts.manifest)
    : opts.nextDir;

  const routes = Array.isArray(budgets.routes) ? budgets.routes : [];
  if (routes.length === 0) fail("perf-budgets.json has no `routes`.");

  const rows = routes.map((r) => {
    if (typeof r.route !== "string" || typeof r.entry !== "string") {
      fail(`invalid budget row: ${JSON.stringify(r)}`);
    }
    const budgetKB = typeof r.maxGzipKB === "number" ? r.maxGzipKB : null;
    const { bytes, chunks } = measure(pages, r.entry, baseDir);
    const over = budgetKB !== null && kb(bytes) > budgetKB;
    return { route: r.route, entry: r.entry, chunks, bytes, budgetKB, status: over ? "OVER" : "ok" };
  });

  process.stdout.write(`\nFirst-load JS per route (gzip -9, de-duplicated)\n\n${table(rows)}\n\n`);

  const overruns = rows.filter((r) => r.status === "OVER");
  if (opts.print) return;
  if (overruns.length > 0) {
    for (const r of overruns) {
      process.stderr.write(
        `[bundle-budget] ${r.route}: ${fmt(kb(r.bytes))} KB gzip > budget ${fmt(r.budgetKB)} KB (+${fmt(kb(r.bytes) - r.budgetKB)} KB)\n`,
      );
    }
    process.stderr.write(
      "[bundle-budget] Shrink the route (dynamic import, drop the dependency) or, if the growth is intended, raise its budget in perf-budgets.json in the same PR.\n",
    );
    process.exit(1);
  }
  process.stdout.write(`[bundle-budget] all ${rows.length} routes within budget.\n`);
}

main();
