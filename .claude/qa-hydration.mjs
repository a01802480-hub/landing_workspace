// Hydration regression test — pre-seeds localStorage (stored values that
// differ from the defaults) then reloads: the prerendered HTML and the
// client's first render must agree, so zero hydration errors.
export default async function run(page, ui) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });

  // Seed stored state that DIFFERS from every default — the mismatch case.
  await page.evaluate(() => {
    const seq = Array.from({ length: 400 }, (_, i) => "ACGT"[i % 4]).join("");
    localStorage.setItem("protheon:rail:expanded", "false");
    localStorage.setItem("protheon:resources:expanded", "false");
    localStorage.setItem("protheon:ide:split", "40");
    localStorage.setItem(
      "protheon:sequence:viewer",
      JSON.stringify({
        name: "stored-seq",
        seq,
        circular: false,
        annotations: [],
        features: [],
        enzymes: [],
        source: "file",
        description: "restored from storage",
      }),
    );
    localStorage.setItem(
      "protheon:resources:registry",
      JSON.stringify([
        {
          id: "res-1",
          kind: "dataframe",
          name: "stored-frame",
          createdAt: 1,
          dataframe: { columns: ["guide"], rows: [["g1"], ["g2"]] },
        },
      ]),
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

  await page.reload();
  await page.waitForSelector('[role="tablist"]', { timeout: 30000 });
  await page.waitForTimeout(2500); // let adoption effects run

  const out = { consoleErrors: [] };

  // 1. Rail + resources sidebar collapsed (adopted stored preferences)
  out.rail = await page.evaluate(() => {
    const nav = document.querySelector('aside[aria-label="Workspace navigation"]');
    const res = document.querySelector('aside[aria-label="Resources"]');
    return {
      navCollapsed: nav ? nav.className.includes("w-14") : null,
      resCollapsed: res ? res.className.includes("w-14") : null,
      resExpandedText: res ? res.innerText.includes("stored-frame") : false,
    };
  });

  // 2. Stored sequence adopted — open the DNA tab and look for it
  let snap = await ui.snapshot();
  const dnaTab = snap.match(/@(e\d+) (?:button|tab) "DNA"/)?.[1];
  if (dnaTab) {
    await ui.click(dnaTab);
    await page.waitForFunction(
      () => document.body.innerText.includes("stored-seq"),
      null,
      { timeout: 15000 },
    );
    out.dna = await page.evaluate(() => {
      const tab = document.getElementById("tab-dna");
      return {
        visible: tab ? getComputedStyle(tab).display !== "none" : null,
        svgCount: tab?.querySelectorAll("svg").length ?? 0,
        hasDescription: tab ? tab.innerText.includes("restored from storage") : false,
      };
    });
  }

  // 3. Stored canvas adopted — open the flows tab
  snap = await ui.snapshot();
  const flowsTab = snap.match(/@(e\d+) (?:button|tab) "Flow builder"/)?.[1];
  if (flowsTab) {
    await ui.click(flowsTab);
    await page.waitForSelector("#tab-flows .react-flow", { timeout: 20000 });
    out.flows = await page.evaluate(() => {
      const nodes = document.querySelectorAll("#tab-flows .react-flow__node");
      const ids = Array.from(nodes).map((n) => n.innerText);
      return {
        nodeCount: nodes.length,
        hasCustomNode: ids.some((t) => t.includes("Workspace sequence") && t.includes("unset") === false) || nodes.length === 1,
      };
    });
  }

  // 4. Storage was not clobbered by pre-adoption writes
  out.storageIntact = await page.evaluate(() => {
    const nav = localStorage.getItem("protheon:rail:expanded");
    const res = localStorage.getItem("protheon:resources:registry");
    const canvas = localStorage.getItem("protheon:flows:canvas");
    return {
      rail: nav,
      resHasStoredFrame: (res || "").includes("stored-frame"),
      canvasHasCustomNode: (canvas || "").includes("custom-input"),
    };
  });

  out.consoleErrors = consoleErrors.filter((t) => !t.includes("React Flow") && !t.includes("attribution"));
  return out;
}
