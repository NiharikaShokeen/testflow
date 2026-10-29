import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
export type Finding = {
  id: string;
  title: string;
  testId?: string;
  severity: string;
  status: string;
  website?: string;
  module?: string;
  steps?: string;
  expected?: string;
  actual?: string;
  environment?: string;
  evidence?: string;
  createdAt?: string;
};
export type ReportMeta = {
  project: string;
  website: string;
  tester: string;
  environment: string;
  scope: string;
  testingDate?: string;
  platform?: string;
  documentTitle?: string;
  sourceDocument?: string;
};
type Run = {
  name: string;
  result: string;
  actual: number | null;
  expected: number;
  ms: number;
  at: string;
  detail: string;
};
const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7e\n\r\t\xa0-\xff]/g, "?");
export async function createQaReport(
  input: { defects: Finding[]; runs: Run[]; report?: Partial<ReportMeta> },
  includeApi = false,
) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.report?.project || "Website"} - QA Report`);
  doc.setAuthor(input.report?.tester || "TestFlow");
  doc.setSubject("Website quality assurance findings");
  const regular = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.13, 0.21, 0.25),
    muted = rgb(0.42, 0.48, 0.51),
    teal = rgb(0.13, 0.46, 0.39),
    line = rgb(0.86, 0.89, 0.9),
    pale = rgb(0.95, 0.97, 0.96);
  const W = 595.28,
    H = 841.89,
    M = 44,
    R = W - M,
    CW = W - 2 * M;
  let page!: PDFPage,
    y = 0;
  const pages: PDFPage[] = [];
  const text = (
    s: unknown,
    x: number,
    yy: number,
    size = 10,
    font: PDFFont = regular,
    color = ink,
  ) => page.drawText(clean(s), { x, y: yy, size, font, color });
  function newPage(label: string) {
    page = doc.addPage([W, H]);
    pages.push(page);
    text("testflow.", M, H - 42, 17, bold, teal);
    text("QUALITY ASSURANCE REPORT", R - 178, H - 39, 8, bold, muted);
    page.drawLine({
      start: { x: M, y: H - 57 },
      end: { x: R, y: H - 57 },
      thickness: 0.6,
      color: line,
    });
    y = H - 87;
    if (label) {
      text(label, M, y, 9, bold, muted);
      y -= 27;
    }
  }
  function ensure(n: number) {
    if (y - n < 58) newPage("CONTINUED");
  }
  function wrap(s: unknown, width: number, size = 10, font: PDFFont = regular) {
    const out: string[] = [];
    for (const para of clean(s).split(/\r?\n/)) {
      if (!para.trim()) {
        out.push("");
        continue;
      }
      let row = "";
      for (const word of para.split(/\s+/)) {
        let token = word;
        if (font.widthOfTextAtSize(token, size) > width) {
          if (row) {
            out.push(row);
            row = "";
          }
          let part = "";
          for (const ch of token) {
            if (font.widthOfTextAtSize(part + ch, size) > width) {
              out.push(part);
              part = "";
            }
            part += ch;
          }
          row = part;
          continue;
        }
        if (row && font.widthOfTextAtSize(row + " " + token, size) > width) {
          out.push(row);
          row = token;
        } else row = row ? row + " " + token : token;
      }
      if (row) out.push(row);
    }
    return out;
  }
  function para(s: unknown, size = 10, color = ink, width = CW, x = M) {
    for (const l of wrap(s || "Not recorded", width, size)) {
      ensure(15);
      text(l, x, y, size, regular, color);
      y -= 15;
    }
  }
  function section(title: string) {
    ensure(45);
    y -= 12;
    text(title, M, y, 12, bold);
    y -= 23;
  }
  function field(label: string, value: unknown) {
    ensure(43);
    text(label.toUpperCase(), M, y, 8, bold, muted);
    y -= 17;
    para(value);
    y -= 14;
  }
  const meta = input.report || {},
    defects = input.defects || [],
    runs = input.runs || [],
    open = defects.filter((d) => d.status !== "Closed").length;
  const date = new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  newPage("TEST FINDINGS / " + date.toUpperCase());
  text("Website QA report", M, y, 26, bold);
  y -= 31;
  para(meta.project || "Website review", 15, teal);
  y -= 11;
  for (const [label, value] of [
    ["Website", meta.website || "See individual findings"],
    ["Testing date", meta.testingDate || "Not recorded"],
    ["Prepared by", meta.tester || "Not recorded"],
    ["Environment", meta.environment || "See individual findings"],
  ]) {
    ensure(30);
    text(label, M, y, 9, bold, muted);
    const rows = wrap(value, CW - 100, 10);
    for (let i = 0; i < rows.length; i++) {
      ensure(16);
      text(rows[i], M + 100, y, 10);
      y -= 15;
    }
    y -= 7;
  }
  y -= 8;
  ensure(74);
  page.drawRectangle({ x: M, y: y - 62, width: CW, height: 72, color: pale });
  const counts = [
    ["TOTAL FINDINGS", defects.length],
    ["OPEN FINDINGS", open],
    [
      "HIGH / CRITICAL",
      defects.filter((d) => ["High", "Critical"].includes(d.severity)).length,
    ],
  ];
  counts.forEach(([label, n], i) => {
    text(label, M + 16 + i * 166, y - 10, 8, bold, muted);
    text(n, M + 16 + i * 166, y - 39, 23, bold, teal);
  });
  y -= 86;
  section("Review scope");
  para(
    meta.scope ||
      "Manual website testing. Findings below were recorded by the tester during review; this report does not certify that all website features have been tested.",
  );
  y -= 4;
  section("Findings register");
  if (!defects.length) {
    para("No manual findings have been recorded in this workspace.");
    y -= 12;
  } else {
    const widths = [56, 279, 77, 95],
      xs = [M, M + 56, M + 335, M + 412];
    const tableHeader = () => {
      ensure(28);
      page.drawRectangle({
        x: M,
        y: y - 7,
        width: CW,
        height: 23,
        color: pale,
      });
      ["ID", "FINDING", "SEVERITY", "STATUS"].forEach((s, i) =>
        text(s, xs[i] + 7, y, 7, bold, muted),
      );
      y -= 24;
    };
    tableHeader();
    defects.forEach((d, i) => {
      const rows = wrap(d.title, widths[1] - 14, 9),
        status = wrap(d.status, widths[3] - 14, 8);
      const height = Math.max(rows.length, status.length) * 13 + 15;
      if (y - height < 62) {
        newPage("FINDINGS REGISTER / CONTINUED");
        tableHeader();
      }
      text("BUG-" + String(i + 1).padStart(3, "0"), M + 7, y, 8, bold, teal);
      rows.forEach((s, j) => text(s, xs[1] + 7, y - j * 13, 9));
      text(d.severity, xs[2] + 7, y, 8);
      status.forEach((s, j) => text(s, xs[3] + 7, y - j * 13, 8));
      y -= height;
      page.drawLine({
        start: { x: M, y: y + 7 },
        end: { x: R, y: y + 7 },
        thickness: 0.4,
        color: line,
      });
    });
  }
  defects.forEach((d, i) => {
    newPage(
      "FINDING " +
        String(i + 1).padStart(2, "0") +
        " / " +
        String(defects.length).padStart(2, "0"),
    );
    text("BUG-" + String(i + 1).padStart(3, "0"), M, y, 10, bold, teal);
    y -= 25;
    for (const title of wrap(d.title, CW, 19, bold)) {
      ensure(27);
      text(title, M, y, 19, bold);
      y -= 25;
    }
    y -= 5;
    text("Severity: " + d.severity, M, y, 10, bold);
    text("Status: " + d.status, M + 240, y, 10, bold);
    y -= 31;
    field("Website / page", d.website || meta.website);
    field("Feature / module", d.module);
    field("Browser and environment", d.environment || meta.environment);
    field("Steps to reproduce", d.steps);
    field("Expected result", d.expected);
    field("Actual result", d.actual);
    if (d.evidence) field("Evidence reference", d.evidence);
    if (d.createdAt) {
      field(
        "Recorded",
        new Date(d.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        }),
      );
    }
  });
  if (includeApi && runs.length) {
    newPage("APPENDIX / AUTOMATED API CHECKS");
    section("API execution history");
    para(
      "These results validate configured HTTP status and optional response assertions. They do not represent a complete functional test of the website.",
    );
    y -= 18;
    runs.forEach((r, i) => {
      ensure(83);
      para(`${i + 1}. ${r.name || "Custom API request"}`, 11);
      para(
        `${r.result} | HTTP ${r.actual ?? "no response"} | Expected ${r.expected} | ${r.ms} ms`,
        9,
        teal,
      );
      para(r.detail, 9, muted);
      y -= 12;
    });
  }
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: M, y: 43 },
      end: { x: R, y: 43 },
      thickness: 0.5,
      color: line,
    });
    p.drawText(
      "TestFlow | " + clean(meta.project || "Website review").slice(0, 65),
      { x: M, y: 28, size: 8, font: regular, color: muted },
    );
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: R - 35,
      y: 28,
      size: 8,
      font: regular,
      color: muted,
    });
  });
  return doc.save();
}
