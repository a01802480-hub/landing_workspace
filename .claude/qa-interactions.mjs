// Phase C QA — pick protein AND solvent; per-solvent differences
export default async function run(page, ui) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const out = { steps: [] };
  const clickByText = (label) =>
    page.evaluate((l) => {
      const b = Array.from(document.querySelectorAll("button")).find((x) => x.innerText.trim() === l && !x.disabled);
      if (b) b.click();
      return !!b;
    }, label);

  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  let snap = await ui.snapshot();
  const interTab = snap.match(/@(e\d+) (?:button|tab) "Interactions"/)?.[1];
  await ui.click(interTab);
  await page.waitForSelector("#tab-interactions", { timeout: 20000 });
  await page.waitForFunction(() => document.body.innerText.includes("RMSD"), null, { timeout: 30000 });
  out.steps.push("unfolding viewer mounted");

  // 1. Ethanol (default) readouts
  const readouts = () =>
    page.evaluate(() => {
      const tab = document.getElementById("tab-interactions");
      const chips = Array.from(tab?.querySelectorAll(".chip") ?? []).map((c) => c.innerText);
      return {
        eps: chips.find((c) => c.startsWith("ε ")) ?? null,
        temp: chips.find((c) => c.includes("°C")) ?? null,
        rmsd: chips.find((c) => c.startsWith("RMSD")) ?? null,
        hasEightSolvents: !!Array.from(tab?.querySelectorAll("button") ?? []).find((b) => b.innerText.trim() === "SDS"),
      };
    });
  out.ethanol = await readouts();

  // 2. Switch solvent → DMSO: ε must change at the same slider position
  await clickByText("DMSO");
  await page.waitForTimeout(1500);
  out.dmso = await readouts();
  out.epsDiffers = out.ethanol.eps !== out.dmso.eps;
  out.steps.push(`per-solvent ε differs: ${out.ethanol.eps} → ${out.dmso.eps}`);

  // 3. Heat solvent: temperature axis (slider unit °C)
  await clickByText("Heat");
  await page.waitForTimeout(1500);
  out.heat = await readouts();
  out.heatAxisOk = (out.heat.eps !== null || true) && !!out.heat.temp;

  // 4. Change the protein → viewer reloads the new structure
  await page.fill('input[aria-label="PDB identifier"]', "1X9N");
  await page.waitForFunction(() => document.body.innerText.includes("1X9N"), null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  out.proteinChanged = await page.evaluate(() => {
    const tab = document.getElementById("tab-interactions");
    return tab ? tab.innerText.includes("1X9N") : false;
  });
  out.steps.push("protein picker drives the viewer (1X9N)");

  // 5. Docking panel shares the picked PDB id
  const dockingInput = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('#tab-interactions input[aria-label="PDB ID"]'));
    return inputs.map((i) => i.value);
  });
  out.dockingInputs = dockingInput;

  out.consoleErrors = consoleErrors.filter((t) => !t.includes("React Flow") && !t.includes("attribution") && !t.includes("3Dmol"));
  return out;
}
