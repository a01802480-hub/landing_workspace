// Legacy-route hydration test: /workspace/flows and /workspace/dna are
// prerendered (SSG) — seeded stored canvas/sequence must not diverge the
// client tree from the server HTML.
export default async function run(page, ui) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // Seed on the IDE first, then navigate to the legacy routes.
  await page.goto("http://localhost:3000/workspace", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  await page.evaluate(() => {
    const seq = Array.from({ length: 400 }, (_, i) => "ACGT"[i % 4]).join("");
    localStorage.setItem("protheon:rail:expanded", "false");
    localStorage.setItem(
      "protheon:sequence:viewer",
      JSON.stringify({ name: "stored-seq", seq, circular: false, annotations: [], features: [], enzymes: [], source: "file" }),
    );
    localStorage.setItem(
      "protheon:flows:canvas",
      JSON.stringify({
        version: 2,
        nodes: [
          {
            id: "custom-input",
            type: "input",
            position: { x: 100, y: 100 },
            data: { kind: "input", sourceKind: "sequence" },
          },
        ],
        edges: [],
      }),
    );
  });

  const out = {};

  // Legacy flows route (prerendered) with a stored canvas
  await page.goto("http://localhost:3000/workspace/flows", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".react-flow", { timeout: 30000 });
  await page.waitForTimeout(2000);
  out.flowsNodeCount = await page.evaluate(() => document.querySelectorAll(".react-flow__node").length);
  out.flowsErrors = consoleErrors.slice();

  // Legacy dna route (prerendered) with a stored sequence
  await page.goto("http://localhost:3000/workspace/dna", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("svg", { timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes("stored-seq"), null, { timeout: 15000 });
  out.dnaErrors = consoleErrors.slice();
  out.dnaShowsStoredSeq = true;

  out.consoleErrors = consoleErrors.filter((t) => !t.includes("React Flow") && !t.includes("attribution"));
  return out;
}
