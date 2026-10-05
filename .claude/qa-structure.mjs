// Structure page regression — the protein viewer must render from the
// raw PDB file (no "Unexpected token" / "Structure file unavailable").
export default async function run(page, ui) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  const snap = await ui.snapshot();
  const structTab = snap.match(/@(e\d+) (?:button|tab) "Structure"/)?.[1];
  if (!structTab) return { error: "no structure tab", snap };
  await ui.click(structTab);
  await page.waitForSelector("#tab-structure", { timeout: 20000 });

  // The model loads (catalog preset or default PDB) then the raw file
  // fetch renders 3dmol — wait for the "Structure file unavailable"
  // panel to never appear AND the viewer canvas to mount.
  await page.waitForTimeout(12000);

  const out = await page.evaluate(() => {
    const tab = document.getElementById("tab-structure");
    return {
      visible: tab ? getComputedStyle(tab).display !== "none" : null,
      hasUnavailablePanel: tab ? tab.innerText.includes("Structure file unavailable") : null,
      hasUnexpectedToken: tab ? tab.innerText.includes("Unexpected token") : null,
      canvasCount: tab?.querySelectorAll("canvas").length ?? 0,
      textSnippet: tab ? tab.innerText.slice(0, 300) : "",
    };
  });
  out.consoleErrors = consoleErrors.filter(
    (t) => !t.includes("React Flow") && !t.includes("attribution") && !t.includes("3Dmol"),
  );
  return out;
}
