// Phase A QA — sequence editor + provenance history
export default async function run(page, ui) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const out = { steps: [] };

  // DOM click — the rail panel is short in the QA viewport and bottom-row
  // buttons can sit half-clipped (hit-testing refuses those points).
  const clickByText = (label) =>
    page.evaluate((l) => {
      const b = Array.from(document.querySelectorAll("button")).find((x) => x.innerText.trim() === l && !x.disabled);
      if (b) b.click();
      return !!b;
    }, label);

  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  let snap = await ui.snapshot();
  const dnaTab = snap.match(/@(e\d+) (?:button|tab) "DNA"/)?.[1];
  if (!dnaTab) return { error: "no DNA tab", snap };
  await ui.click(dnaTab);
  await page.waitForSelector("#tab-dna svg", { timeout: 30000 });
  out.steps.push("seqviz mounted");

  // 1. Quick op: insert 4 bp at position 1 (exercises editSequence + audit)
  const before = await page.evaluate(() => {
    const t = document.querySelector('textarea[aria-label="Sequence letters"]');
    return t ? t.value.replace(/\s+/g, "").length : 0;
  });
  await page.fill('input[aria-label="Insert position"]', "1");
  await page.fill('input[aria-label="Insert text"]', "AAAA");
  const clickedInsert = await clickByText("Insert");
  out.insertClicked = clickedInsert;
  await page.waitForFunction(
    (b) => document.body.innerText.includes("rev 1") && document.body.innerText.includes((b + 4).toLocaleString()),
    before,
    { timeout: 10000 },
  );
  out.steps.push(`insert applied (${before} → ${before + 4} bp, rev 1)`);

  // 2. Free editor: append 4 bp via Apply
  const ta = 'textarea[aria-label="Sequence letters"]';
  await page.focus(ta); // switches to raw draft
  await page.waitForTimeout(400); // let the focus re-render settle before filling
  const raw = await page.evaluate((sel) => document.querySelector(sel).value.replace(/\s+/g, ""), ta);
  await page.fill(ta, raw + "TTTT");
  const clickedApply = await clickByText("Apply");
  out.applyClicked = clickedApply;
  await page.waitForFunction(() => document.body.innerText.includes("rev 2"), null, { timeout: 10000 }).catch(async () => {
    out.applyDiagnostics = await page.evaluate(() => {
      const tab = document.getElementById("tab-dna");
      const t = document.querySelector('textarea[aria-label="Sequence letters"]');
      return {
        alerts: tab ? Array.from(tab.querySelectorAll('[role="alert"]')).map((p) => p.innerText) : [],
        notes: tab ? Array.from(tab.querySelectorAll("p")).map((p) => p.innerText).filter((x) => x.includes("applied") || x.includes("revision")) : [],
        taLen: t ? t.value.replace(/\s+/g, "").length : 0,
        dirtyHint: tab ? tab.innerText.includes("unsaved draft") : false,
      };
    });
    return out;
  });
  out.steps.push("free-editor Apply appended 4 bp (rev 2)");

  // seqviz still renders after remounts
  const svgs = await page.evaluate(() => document.querySelectorAll("#tab-dna svg").length);
  out.svgsAfterEdits = svgs;

  // 3. History: verify chain green + export button exists
  const clickedHistory = await clickByText("History");
  out.historyClicked = clickedHistory;
  await page.waitForTimeout(400);
  const clickedVerify = await clickByText("Verify chain");
  out.verifyClicked = clickedVerify;
  await page.waitForFunction(() => document.body.innerText.includes("verified"), null, { timeout: 10000 });
  out.steps.push("history chain verified green");

  out.historyText = await page.evaluate(() => {
    const tab = document.getElementById("tab-dna");
    return tab ? tab.innerText.slice(-500) : "";
  });
  out.consoleErrors = consoleErrors.filter((t) => !t.includes("React Flow") && !t.includes("attribution"));
  return out;
}
