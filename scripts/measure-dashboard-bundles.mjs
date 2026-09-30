// Compare Vite builds made with --manifest, before and after lazy dialog mounting.
// Usage: node scripts/measure-dashboard-bundles.mjs <baseline-dir> <updated-dir>
// Reports JS bytes only; these are bundle measurements, not browser load timings.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const [baselineDir, updatedDir] = process.argv.slice(2);
if (!baselineDir || !updatedDir) {
  throw new Error("Provide baseline and updated Vite build directories (built with --manifest).");
}

function measure(directory, includeClosedDialogs) {
  const manifest = JSON.parse(readFileSync(resolve(directory, ".vite/manifest.json"), "utf8"));
  const sumGraph = (entries) => {
    const visited = new Set();
    const visit = (entry) => {
      if (visited.has(entry)) return;
      if (!manifest[entry]) throw new Error(`Missing manifest entry: ${entry}`);
      visited.add(entry);
      for (const dependency of manifest[entry].imports ?? []) visit(dependency);
    };
    entries.forEach(visit);
    const chunks = [...visited].map((key) => {
      const file = manifest[key].file;
      const content = readFileSync(resolve(directory, file));
      return { file, bytes: content.length, gzipBytes: gzipSync(content).length };
    });
    return {
      bytes: chunks.reduce((sum, chunk) => sum + chunk.bytes, 0),
      gzipBytes: chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
      chunks,
    };
  };
  const dashboard = ["index.html", "src/components/dashboard.tsx"];
  const chartEntry = "src/components/dashboard/PerformanceChartPlot.tsx";
  const chart = manifest[chartEntry] ? [chartEntry] : [];
  const dialogs = includeClosedDialogs ? [
    "src/components/trips/TripDialog.tsx",
    "src/components/trips/CreateDischargeDialog.tsx",
    "src/components/trips/BulkImportDialog.tsx",
  ] : [];
  return {
    shell: sumGraph(["index.html"]),
    dashboardShell: sumGraph(dashboard),
    dashboardWithChart: sumGraph([...dashboard, ...chart, ...dialogs]),
  };
}

console.log(JSON.stringify({
  baseline: measure(baselineDir, true),
  updated: measure(updatedDir, false),
}, null, 2));
