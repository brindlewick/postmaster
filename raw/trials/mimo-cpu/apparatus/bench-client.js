// Read a server-sent events body with fetch and a default reader, as an agent reads its model's
// stream, and report this process's cost per chunk. Runs on Bun and on Node.
//
//   bench-client.js <url> [retained heap in MB]
//
// With a retained heap, first keeps that many megabytes of small objects alive, as a long-lived
// agent does. Prints one JSON line: chunks read, CPU per chunk and as a share of one core from
// the first chunk to the end, minor page faults per chunk, and how many chunks were views on a
// backing buffer of each size.
import { readFileSync } from "fs";

const [url, heapMb = "0"] = process.argv.slice(2);
const keep = [];
for (let i = 0; i < (+heapMb * 1048576) / 64; i++) keep.push({ a: i, b: "x" + (i % 1000), c: [i] });
const faults = () => {
  const s = readFileSync("/proc/self/stat", "utf8");
  return +s.slice(s.lastIndexOf(")") + 2).split(" ")[7];
};
const res = await fetch(url);
const reader = res.body.getReader();
let n = 0, c0, t0, f0;
const backing = {};
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  if (n === 0) { c0 = process.cpuUsage(); t0 = performance.now(); f0 = faults(); }
  n++;
  backing[value.buffer.byteLength] = (backing[value.buffer.byteLength] || 0) + 1;
}
const c = process.cpuUsage(c0), wall = (performance.now() - t0) / 1000, cpu = (c.user + c.system) / 1e6;
console.log(JSON.stringify({
  runtime: typeof Bun === "undefined" ? `node ${process.version}` : `bun ${Bun.version}`,
  retained_mb: +heapMb, chunks: n, cpu_pct: +((cpu * 100) / wall).toFixed(1),
  ms_per_chunk: +((cpu * 1000) / n).toFixed(2), faults_per_chunk: Math.round((faults() - f0) / n),
  backing_buffer_bytes: backing, kept: keep.length,
}));
