// IDE shell QA — tabs, hash routing, keep-alive canvases
export default async function run(page, ui) {
  const out = { steps: [] };

  // 1. Shell basics: TopBar heading + tab strip
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  out.h1 = await page.evaluate(() => document.querySelector("h1")?.innerText ?? null);
  out.steps.push("tablist found");

  const snap = await ui.snapshot();
  out.hasDnaTab = /"DNA"/.test(snap);
  out.hasFlowsTab = /"Flow builder"/.test(snap);

  // 2. DNA tab → seqviz canvas mounts
  const dnaRef = snap.match(/@(e\d+) (?:button|tab) "DNA"/)?.[1];
  if (!dnaRef) return { error: "no DNA tab", snap };
  await ui.click(dnaRef);
  await page.waitForSelector('#tab-dna svg', { timeout: 20000 });
  await page.waitForTimeout(1500);
  out.hashAfterDna = await page.evaluate(() => location.hash);
  out.dna = await page.evaluate(() => {
    const el = document.getElementById("tab-dna");
    return {
      visible: el ? getComputedStyle(el).display !== "none" : null,
      svgCount: el?.querySelectorAll("svg").length ?? 0,
      snippet: el?.innerText?.slice(0, 120) ?? "",
    };
  });
  out.steps.push("dna mounted");

  // 3. Flows tab → React Flow canvas mounts (keep-alive: dna stays mounted)
  const snap2 = await ui.snapshot();
  const flowsRef = snap2.match(/@(e\d+) (?:button|tab) "Flow builder"/)?.[1];
  if (!flowsRef) return { error: "no flows tab", snap2 };
  await ui.click(flowsRef);
  await page.waitForSelector('#tab-flows .react-flow', { timeout: 20000 });
  await page.waitForTimeout(1200);
  out.hashAfterFlows = await page.evaluate(() => location.hash);
  out.flows = await page.evaluate(() => {
    const el = document.getElementById("tab-flows");
    return {
      visible: el ? getComputedStyle(el).display !== "none" : null,
      nodeCount: el?.querySelectorAll(".react-flow__node").length ?? 0,
      snippet: el?.innerText?.slice(0, 160) ?? "",
    };
  });
  out.dnaStillMounted = await page.evaluate(() => {
    const el = document.getElementById("tab-dna");
    return el ? el.querySelectorAll("svg").length > 0 : null;
  });
  out.steps.push("flows mounted, dna kept alive");

  // 4. Back to DNA — instant, canvas still there
  const snap3 = await ui.snapshot();
  const dnaRef3 = snap3.match(/@(e\d+) (?:button|tab) "DNA"/)?.[1];
  if (!dnaRef3) return { error: "no dna tab (2)", snap3 };
  await ui.click(dnaRef3);
  await page.waitForTimeout(500);
  out.hashBack = await page.evaluate(() => location.hash);
  out.dnaBackVisible = await page.evaluate(() => {
    const el = document.getElementById("tab-dna");
    return el ? getComputedStyle(el).display !== "none" : null;
  });

  // 5. Split view
  const snap4 = await ui.snapshot();
  const splitRef = snap4.match(/@(e\d+) (?:button|tab) "Split"/)?.[1];
  if (splitRef) {
    await ui.click(splitRef);
    await page.waitForTimeout(1500);
    out.split = await page.evaluate(() => ({
      splitters: document.querySelectorAll('[role="separator"]').length,
      dnaVisible: (() => { const el = document.getElementById("tab-dna"); return el ? getComputedStyle(el).display !== "none" : null; })(),
      flowsVisible: (() => { const el = document.getElementById("tab-flows"); return el ? getComputedStyle(el).display !== "none" : null; })(),
    }));
  }
  return out;
}
