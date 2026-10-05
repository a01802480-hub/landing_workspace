// Phase E QA — all-substitutions scan (small window, real upstream)
export default async function run(page, ui) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const out = { steps: [] };

  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  let snap = await ui.snapshot();
  const varTab = snap.match(/@(e\d+) (?:button|tab) "Variants"/)?.[1];
  await ui.click(varTab);
  await page.waitForSelector("#tab-variants", { timeout: 20000 });
  await page.waitForTimeout(1200);

  // The single-substitution form auto-runs on boot (p.Arg641Leu) — wait for it.
  try {
    await page.waitForFunction(() => document.body.innerText.includes("Mean pathogenicity"), null, { timeout: 60000 });
    out.singleSubstitutionRendered = true;
  } catch {
    out.singleSubstitutionRendered = false;
  }
  out.steps.push("single-substitution cards render");

  // Scan a 4-position window (641–644) — real upstream, bounded wait.
  await page.fill('input[aria-label="Scan accession"]', "P18858");
  await page.fill('input[aria-label="Scan start position"]', "641");
  await page.fill('input[aria-label="Scan end position"]', "644");
  const scanClicked = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => x.innerText.trim() === "Scan all substitutions" && !x.disabled);
    if (b) b.click();
    return !!b;
  });
  out.scanClicked = scanClicked;

  // Partial results render while running; wait for the terminal summary.
  try {
    await page.waitForFunction(
      () => document.body.innerText.includes("pathogenic ·") || document.body.innerText.includes("4 positions"),
      null,
      { timeout: 180000 },
    );
    out.scanDone = true;
  } catch {
    out.scanDone = false;
  }
  out.steps.push("scan reached terminal with summary");

  out.table = await page.evaluate(() => {
    const tab = document.getElementById("tab-variants");
    const rows = Array.from(tab?.querySelectorAll("table tbody tr") ?? []);
    return {
      rowCount: rows.length,
      firstRows: rows.slice(0, 5).map((r) => r.innerText.replace(/\n/g, " | ")),
      hasPathogenic: !!rows.find((r) => r.innerText.includes("pathogenic")),
    };
  });
  out.steps.push(`scan table: ${out.table.rowCount} rows`);

  // Row click → the four verdict cards (the "same screen" detail)
  const detailClicked = await page.evaluate(() => {
    const tab = document.getElementById("tab-variants");
    const row = Array.from(tab?.querySelectorAll("table tbody tr") ?? []).find((r) => r.innerText.includes("pathogenic") || r.innerText.includes("ambiguous"));
    if (row) row.click();
    return !!row;
  });
  out.detailClicked = detailClicked;
  await page.waitForTimeout(600);
  out.detailCards = await page.evaluate(() => {
    const tab = document.getElementById("tab-variants");
    return {
      hasPathogenicity: tab ? tab.innerText.includes("Pathogenicity") : false,
      hasConfidence: tab ? tab.innerText.includes("Structural confidence") : false,
      hasTolerance: tab ? tab.innerText.includes("Tolerance") : false,
      hasConsensus: tab ? tab.innerText.includes("Consensus") : false,
    };
  });
  out.steps.push("row click → four verdict cards");

  out.consoleErrors = consoleErrors.filter((t) => !t.includes("React Flow") && !t.includes("attribution"));
  return out;
}
