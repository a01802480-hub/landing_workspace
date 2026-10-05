// Phase D QA — on-demand comparative workbench (no fixed dashboard)
export default async function run(page, ui) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const out = { steps: [] };

  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  let snap = await ui.snapshot();
  const compTab = snap.match(/@(e\d+) (?:button|tab) "Comparative"/)?.[1];
  await ui.click(compTab);
  await page.waitForSelector("#tab-comparative", { timeout: 20000 });
  await page.waitForTimeout(1500);

  // 1. No auto-dashboard: no ortholog/domain content on boot, no auto run
  const bootText = await page.evaluate(() => document.getElementById("tab-comparative")?.innerText ?? "");
  out.noAutoDashboard = !bootText.includes("Ortholog") && !bootText.includes("blue whale") && !bootText.includes("Domain architecture");
  out.steps.push("no fixed dashboard on boot");

  // 2. Paste FASTA (hermetic — no upstream needed) and run pairwise
  const fastaText = ">alpha_test\nMSEVKKVFGGLLAGAAAKGAPKPKAKLSALGEGEPDLAVVLADTFQGVKVPLELVEKLKAEEAGFTFQGHKVTSVQ\n>beta_test\nMSEVKKVFGGLQAGAAAKGAPKPKAKLSALGEGEPDLAVVLAESFQGVKVPLELVEKLKAAEAGFTFQGHKVTSLQ\n";
  await page.fill('textarea[aria-label="FASTA paste area"]', fastaText);
  const addClicked = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => x.innerText.trim() === "Add to selection" && !x.disabled);
    if (b) b.click();
    return !!b;
  });
  out.fastaAdded = addClicked;
  await page.waitForFunction(() => document.body.innerText.includes("2 / 8"), null, { timeout: 10000 });
  out.steps.push("pasted FASTA → 2 selected");

  // 3. Pairwise: alpha vs beta
  await page.evaluate(() => {
    const selA = document.querySelector('select[aria-label="First sequence"]');
    const selB = document.querySelector('select[aria-label="Second sequence"]');
    if (selA) {
      selA.value = "alpha_test";
      selA.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (selB) {
      selB.value = "beta_test";
      selB.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.waitForTimeout(400);
  const pairwiseClicked = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => x.innerText.trim() === "Align pairwise" && !x.disabled);
    if (b) b.click();
    return !!b;
  });
  out.pairwiseClicked = pairwiseClicked;
  await page.waitForFunction(() => document.body.innerText.includes("% identity"), null, { timeout: 15000 });
  out.steps.push("pairwise alignment rendered");

  // 4. Search path (upstream UniProt — real call; report if it works)
  await page.fill('input[aria-label="Sequence search query"]', "P18858");
  const searchClicked = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => x.innerText.trim() === "Search" && !x.disabled);
    if (b) b.click();
    return !!b;
  });
  out.searchClicked = searchClicked;
  try {
    await page.waitForFunction(() => document.body.innerText.includes("LIG1") || document.body.innerText.includes("P18858"), null, { timeout: 45000 });
    out.searchFound = true;
    out.steps.push("upstream search found P18858/LIG1");
  } catch {
    out.searchFound = false;
    out.steps.push("upstream search unavailable (offline?) — paste path verified");
  }

  out.consoleErrors = consoleErrors.filter((t) => !t.includes("React Flow") && !t.includes("attribution"));
  return out;
}
