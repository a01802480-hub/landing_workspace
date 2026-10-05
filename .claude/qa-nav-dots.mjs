// Nav + dot regression: click the CRISPR tab (tab strip AND side rail),
// verify the panel switches; probe status-dot bounding boxes for giant ovals.
export default async function run(page, ui) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  const out = {};

  // 1. Tab strip → CRISPR
  let snap = await ui.snapshot();
  const crisprTab = snap.match(/@(e\d+) (?:button|tab) "CRISPR"/)?.[1];
  if (!crisprTab) return { error: "no CRISPR tab", snap };
  await ui.click(crisprTab);
  await page.waitForTimeout(1500);
  out.afterTabClick = await page.evaluate(() => ({
    hash: location.hash,
    crisprVisible: (() => {
      const el = document.getElementById("tab-crispr");
      return el ? getComputedStyle(el).display !== "none" : null;
    })(),
    crisprText: document.getElementById("tab-crispr")?.innerText?.slice(0, 200) ?? "",
  }));

  // 2. Tab strip → DNA, then side rail → CRISPR
  snap = await ui.snapshot();
  const dnaTab = snap.match(/@(e\d+) (?:button|tab) "DNA"/)?.[1];
  if (dnaTab) await ui.click(dnaTab);
  await page.waitForTimeout(600);
  snap = await ui.snapshot();
  const railCrispr = snap.match(/@(e\d+) (?:link|button) "CRISPR"/)?.[1];
  if (railCrispr) {
    await ui.click(railCrispr);
    await page.waitForTimeout(1500);
  }
  out.afterRailClick = await page.evaluate(() => ({
    hash: location.hash,
    pathname: location.pathname,
    crisprVisible: (() => {
      const el = document.getElementById("tab-crispr");
      return el ? getComputedStyle(el).display !== "none" : null;
    })(),
  }));

  // 3. Giant-dot probe — any status-dot larger than ~20px is the oval bug
  out.dots = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll(".status-dot"));
    return dots.map((d) => {
      const r = d.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), parent: d.parentElement?.className?.slice(0, 40) };
    });
  });
  out.consoleErrors = consoleErrors.filter((t) => !t.includes("React Flow") && !t.includes("attribution"));
  return out;
}
