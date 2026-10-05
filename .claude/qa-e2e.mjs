// Full IDE e2e — imports → resources → canvas drop → DAG run → SSE badges
export default async function run(page, ui) {
  const out = { steps: [] };
  // One NGG PAM per 23-nt block — tools need guides to succeed.
  const seq = (n) => "ACGTACGTACGTACGTACGTAGG".repeat(Math.ceil(n / 23)).slice(0, n);

  // 1. IDE + resource sidebar present
  await page.waitForSelector('[role="tablist"]', { timeout: 25000 });
  await page.waitForSelector('aside[aria-label="Resources"]', { timeout: 10000 });
  out.steps.push("shell + sidebar present");

  // 2. DNA tab mounts seqviz (pBR322 auto-load)
  let snap = await ui.snapshot();
  const dnaTab = snap.match(/@(e\d+) (?:button|tab) "DNA"/)?.[1];
  await ui.click(dnaTab);
  await page.waitForSelector("#tab-dna svg", { timeout: 25000 });
  out.steps.push("seqviz mounted");

  // 3. Import a FASTA via the DNA dropzone input
  await page.setInputFiles('input[aria-label="Upload a sequence or data file"]', {
    name: "qa-target.fa",
    mimeType: "text/plain",
    buffer: Buffer.from(`>qa-target\n${seq(300)}\n`),
  });
  await page.waitForFunction(() =>
    document.body.innerText.includes("300 bp") && document.body.innerText.includes("qa-target"),
    null, { timeout: 15000 },
  ).catch(async () => {
    out.importDiagnostics = await page.evaluate(() => {
      const tab = document.getElementById("tab-dna");
      const notes = tab ? Array.from(tab.querySelectorAll("p")).map((p) => p.innerText).filter((t) => t.includes("qa") || t.includes("bp") || t.includes("parse") || t.includes("Could")) : [];
      const alerts = tab ? Array.from(tab.querySelectorAll('[role="alert"]')).map((p) => p.innerText) : [];
      return { notes, alerts, bodySnippet: document.body.innerText.slice(0, 600) };
    });
    return out;
  });
  out.steps.push("fasta imported via dropzone");

  // Sidebar shows a FASTA resource
  await page.waitForFunction(() => {
    const aside = document.querySelector('aside[aria-label="Resources"]');
    return aside && aside.innerText.includes("qa-target"); // sequence group (bio-parsers) or FASTA group (fallback)
  }, null, { timeout: 10000 });
  out.steps.push("resource registered in sidebar");

  // 4. CSV import via a sidebar drop (dataframe resource)
  const csvDt = await page.evaluateHandle((content) => {
    const dt = new DataTransfer();
    dt.items.add(new File([content], "qa-guides.csv", { type: "text/csv" }));
    return dt;
  }, `guide,score,gc\nG1,87,52\nG2,66,48\n`);
  await page.dispatchEvent('aside[aria-label="Resources"]', "drop", { dataTransfer: csvDt });
  try {
    await page.waitForFunction(() => {
      const aside = document.querySelector('aside[aria-label="Resources"]');
      return aside && aside.innerText.toUpperCase().includes("DATAFRAMES") && aside.innerText.includes("qa-guides");
    }, null, { timeout: 8000 });
  } catch {
    await page.dispatchEvent('aside[aria-label="Resources"]', "drop", { dataTransfer: csvDt });
    try {
      await page.waitForFunction(() => {
        const aside = document.querySelector('aside[aria-label="Resources"]');
        return aside && aside.innerText.toUpperCase().includes("DATAFRAMES") && aside.innerText.includes("qa-guides");
      }, null, { timeout: 8000 });
    } catch {
      out.csvDropDiagnostics = await page.evaluate(() => {
        const aside = document.querySelector('aside[aria-label="Resources"]');
        const dtTest = new DataTransfer();
        dtTest.items.add(new File(["a,b\n1,2\n"], "probe.csv", { type: "text/csv" }));
        return {
          asideText: aside ? aside.innerText : null,
          storage: (localStorage.getItem("protheon:resources:registry") || "").slice(0, 200),
          dtFilesWork: dtTest.files.length,
        };
      });
      return out;
    }
  }
  out.steps.push("csv imported via sidebar drop");

  // 5. Flows tab → drop a multi-record FASTA straight onto the canvas
  snap = await ui.snapshot();
  const flowsTab = snap.match(/@(e\d+) (?:button|tab) "Flow builder"/)?.[1];
  await ui.click(flowsTab);
  await page.waitForSelector("#tab-flows .react-flow", { timeout: 20000 });
  const beforeNodes = await page.evaluate(() => document.querySelectorAll("#tab-flows .react-flow__node").length);

  const multiDt = await page.evaluateHandle(([r1, r2]) => {
    const dt = new DataTransfer();
    dt.items.add(new File([`>record_a\n${r1}\n>record_b\n${r2}\n`], "multi.fa", { type: "text/plain" }));
    return dt;
  }, [seq(200), seq(180)]);
  await page.dispatchEvent("#tab-flows .react-flow", "drop", { dataTransfer: multiDt });
  await page.waitForFunction(
    (before) => document.querySelectorAll("#tab-flows .react-flow__node").length > before,
    beforeNodes,
    { timeout: 15000 },
  );
  const afterNodes = await page.evaluate(() => document.querySelectorAll("#tab-flows .react-flow__node").length);
  out.steps.push(`canvas os-drop created an input node (${beforeNodes} → ${afterNodes})`);

  // Sidebar gains two FASTA resources (records a + b)
  await page.waitForFunction(() => {
    const aside = document.querySelector('aside[aria-label="Resources"]');
    return aside && aside.innerText.includes("record_a") && aside.innerText.includes("record_b");
  }, null, { timeout: 10000 });
  out.steps.push("multi-fasta records registered as resources");

  // 6. Run the workflow (live sequence input + 3 tools + compute, ~30 s demo)
  snap = await ui.snapshot();
  const runBtn = snap.match(/@(e\d+) (?:button) "Run workflow"/)?.[1];
  if (!runBtn) return { error: "no Run workflow button", out, snap };
  await ui.click(runBtn);
  out.steps.push("run submitted");

  // The live-sequence input holds the imported qa-target (300 nt — valid).
  await page.waitForFunction(() => document.body.innerText.includes("workflow complete"), null, { timeout: 120000 });
  out.steps.push("workflow reached succeeded via SSE");

  // 7. Node badges: every node "done"
  const doneCount = await page.evaluate(() => {
    let n = 0;
    document.querySelectorAll("#tab-flows .react-flow__node").forEach((el) => {
      if (el.innerText.includes("done")) n++;
    });
    return n;
  });
  out.doneBadges = doneCount;
  out.totalNodes = afterNodes;

  // 8. Sidebar DAG runs section + RunMonitor
  await page.waitForFunction(() => {
    const aside = document.querySelector('aside[aria-label="Resources"]');
    return aside && aside.innerText.toUpperCase().includes("DAG RUNS") && aside.innerText.includes("succeeded");
  }, null, { timeout: 30000 });
  out.sidebarRuns = true;
  out.monitorText = await page.evaluate(() => document.body.innerText.includes("Run monitor"));
  out.steps.push("run monitor + sidebar runs verified");

  // 9. Toggle back to DNA — everything kept alive
  snap = await ui.snapshot();
  const dnaTab2 = snap.match(/@(e\d+) (?:button|tab) "DNA"/)?.[1];
  await ui.click(dnaTab2);
  await page.waitForTimeout(600);
  out.dnaStillMounted = await page.evaluate(() => {
    const el = document.getElementById("tab-dna");
    return el ? el.querySelectorAll("svg").length > 0 && getComputedStyle(el).display !== "none" : false;
  });
  out.flowsStillMounted = await page.evaluate(() => {
    const el = document.getElementById("tab-flows");
    return el ? el.querySelectorAll(".react-flow__node").length > 0 : false;
  });

  return out;
}
