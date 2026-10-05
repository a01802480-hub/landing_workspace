// Phase B QA — CRISPR → editable results → plasmid design → assembly → digest record
export default async function run(page, ui) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const out = { steps: [] };
  const clickByText = (label) =>
    page.evaluate((l) => {
      const b = Array.from(document.querySelectorAll("button")).find((x) => x.innerText.trim().includes(l) && !x.disabled);
      if (b) b.click();
      return !!b;
    }, label);

  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  let snap = await ui.snapshot();
  const crisprTab = snap.match(/@(e\d+) (?:button|tab) "CRISPR"/)?.[1];
  await ui.click(crisprTab);
  await page.waitForSelector("#tab-crispr", { timeout: 20000 });
  await page.waitForTimeout(800);

  // 1. Demo target → design guides → results table
  await clickByText("Demo target");
  await page.waitForTimeout(400);
  await clickByText("Design guides");
  await page.waitForFunction(() => document.body.innerText.toUpperCase().includes("RANKED GUIDES"), null, { timeout: 20000 });
  out.steps.push("guides designed");

  // 2. Select the first guide row → Design plasmid
  await page.waitForFunction(() => document.querySelectorAll("#tab-crispr table tbody tr").length > 0, null, { timeout: 20000 });
  await page.evaluate(() => {
    const row = document.querySelector("#tab-crispr table tbody tr");
    if (row) row.click();
  });
  await page.waitForTimeout(500);
  const designClicked = await clickByText("Design plasmid with this guide");
  out.designClicked = designClicked;
  await page.waitForTimeout(1200);

  // 3. DNA tab → Plasmid rail tab → spacer prefilled from the guide
  await page.waitForSelector("#tab-dna", { timeout: 20000 });
  await clickByText("Plasmid");
  await page.waitForTimeout(1200);
  const spacerFilled = await page.evaluate(() => {
    const ta = document.querySelector('textarea[aria-label="Part sequence: guide spacer"]');
    return ta ? ta.value.replace(/\s+/g, "") : "";
  });
  out.spacerFilled = spacerFilled;
  out.spacerOk = /^[ACGT]{20}$/.test(spacerFilled);
  out.steps.push(`spacer prefilled (${spacerFilled})`);

  // 4. Assemble as a new sequence
  const assembledBtn = await clickByText("Assemble (");
  out.assembleClicked = assembledBtn;
  await page.waitForFunction(() => document.body.innerText.includes("designed plasmid"), null, { timeout: 15000 });
  out.steps.push("assembled → new workspace sequence");

  out.assembly = await page.evaluate(() => {
    const tab = document.getElementById("tab-dna");
    return {
      bp: document.body.innerText.match(/rev 0/) ? "rev 0" : null,
      hasU6: tab ? tab.innerText.includes("U6 promoter") : false,
      hasScaffold: tab ? tab.innerText.includes("sgRNA scaffold") : false,
      resourceSidebarHas: (() => {
        const aside = document.querySelector('aside[aria-label="Resources"]');
        return aside ? aside.innerText.includes("designed plasmid") : false;
      })(),
    };
  });

  // 5. Digest panel: record verification (creates the audit genesis + entry)
  await clickByText("Digest");
  await page.waitForTimeout(800);
  const digestRecorded = await clickByText("Record digest verification");
  out.digestRecorded = digestRecorded;
  await page.waitForTimeout(800);
  out.digestNote = await page.evaluate(() => document.body.innerText.includes("added to the history"));

  // 6. History shows the digest entry + verify green
  await clickByText("History");
  await page.waitForTimeout(500);
  await clickByText("Verify chain");
  await page.waitForFunction(() => document.body.innerText.includes("verified"), null, { timeout: 10000 });
  out.steps.push("history chain verified after digest record");

  out.consoleErrors = consoleErrors.filter((t) => !t.includes("React Flow") && !t.includes("attribution"));
  return out;
}
