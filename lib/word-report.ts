import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { templateBase64, patterns } from "./zuka-template";
import type { Finding, ReportMeta } from "./qa-report";
export type Emphasis = { start: number; end: number };
type FormattedFinding = Finding & {
  emphasis?: { steps?: Emphasis[]; actual?: Emphasis[]; expected?: Emphasis[] };
  numberSteps?: boolean;
};
type Meta = Partial<ReportMeta> & {
  documentTitle?: string;
  platform?: string;
  testingDate?: string;
};
const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const bold = (r: string) =>
  r
    .replace(/<w:b(?:Cs)?(?:\s[^>]*)?\s*\/>/g, "")
    .replace("</w:rPr>", '<w:b w:val="1"/><w:bCs w:val="1"/></w:rPr>');
function dateLabel(date?: string) {
  if (!date) return "Not recorded";
  const d = new Date(date + "T12:00:00Z");
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });
}
export async function createWordReport(data: {
  report?: Meta;
  defects: FormattedFinding[];
}) {
  const meta = data.report || {},
    parts: string[] = [];
  let list = 100;
  const files = unzipSync(
    Uint8Array.from(atob(templateBase64), (c) => c.charCodeAt(0)),
  );
  let numbering = strFromU8(files["word/numbering.xml"]);
  const run = (text: string, r: string) =>
    `<w:r>${r}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  function p(
    role: keyof typeof patterns,
    text: string,
    options: {
      p?: string;
      r?: string;
      spans?: Emphasis[];
      offset?: number;
    } = {},
  ) {
    const pattern = patterns[role],
      r = options.r || pattern.r;
    let content = "";
    let start = 0;
    const spans = (options.spans || [])
      .map((s) => ({
        start: Math.max(0, s.start - (options.offset || 0)),
        end: Math.min(text.length, s.end - (options.offset || 0)),
      }))
      .filter((s) => s.end > s.start)
      .sort((a, b) => a.start - b.start);
    for (const span of spans) {
      const a = Math.max(start, span.start),
        b = span.end;
      if (a > start) content += run(text.slice(start, a), r);
      if (b > a) content += run(text.slice(a, b), bold(r));
      start = Math.max(start, b);
    }
    content += run(text.slice(start), r);
    parts.push(`<w:p>${options.p || pattern.p}${content}</w:p>`);
  }
  function text(
    role: "body" | "expected",
    value: string,
    spans: Emphasis[] = [],
  ) {
    let offset = 0;
    const lines = (value || "Not recorded")
      .replace(/\r\n/g, "\n")
      .replace(/\u2028/g, "\n")
      .split("\n");
    for (const line of lines) {
      if (!line.trim()) {
        parts.push(
          `<w:p>${patterns.expected.p}${run("", patterns.expected.r)}</w:p>`,
        );
      } else
        p(
          /^(success|message|error|upstream)\s*:/.test(line) ? "error" : role,
          line,
          { spans, offset },
        );
      offset += line.length + 1;
    }
  }
  p("title", meta.documentTitle || "Website Testing Report");
  for (const [label, value] of [
    ["Prepared by: ", meta.tester || "Not recorded"],
    ["Testing Date: ", dateLabel(meta.testingDate)],
    ["Platform: ", meta.platform || meta.project || "Not recorded"],
    ["Scope: ", meta.scope || "Not recorded"],
  ])
    parts.push(
      `<w:p>${patterns.meta.p}${run(label, patterns.metaLabel.r)}${run(value, patterns.meta.r)}</w:p>`,
    );
  p("total", "Total Issues Reported: " + data.defects.length);
  // The original separates metadata from findings with two body lines, not image space.
  parts.push(
    `<w:p>${patterns.expected.p}</w:p><w:p>${patterns.expected.p}</w:p>`,
  );
  data.defects.forEach((d, i) => {
    const issueP = patterns.issue.p.replace(
      "</w:pPr>",
      "<w:keepNext/></w:pPr>",
    );
    p("issue", `Issue ${i + 1}: ${d.title}`, { p: issueP });
    p("label", "Steps to Reproduce:", {
      p: patterns.label.p.replace("</w:pPr>", "<w:keepNext/></w:pPr>"),
    });
    const id = ++list;
    numbering = numbering.replace(
      "</w:numbering>",
      `<w:num w:numId="${id}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num></w:numbering>`,
    );
    let offset = 0,
      stepIndex = 0;
    const stepCount = (d.steps || "Not recorded")
      .split("\n")
      .filter((s) => s.trim()).length;
    for (const line of (d.steps || "Not recorded").split("\n")) {
      if (!line.trim()) {
        offset += line.length + 1;
        continue;
      }
      const prefix = line.match(/^\s*\d+[.)]\s+/)?.[0] || "";
      let pp = patterns.step.p.replace(
        /<w:numId w:val="\d+"\/>/,
        `<w:numId w:val="${id}"/>`,
      );
      if (d.numberSteps === false)
        pp = pp.replace(/<w:numPr>.*?<\/w:numPr>/, "");
      if (++stepIndex < stepCount)
        pp = pp.replace("</w:pPr>", "<w:keepNext/></w:pPr>");
      p("step", line.slice(prefix.length), {
        p: pp,
        spans: d.emphasis?.steps,
        offset: offset + prefix.length,
      });
      offset += line.length + 1;
    }
    parts.push(`<w:p>${patterns.expected.p}</w:p>`);
    p("label", "Observed Result:", {
      p: patterns.label.p.replace("</w:pPr>", "<w:keepNext/></w:pPr>"),
    });
    text("body", d.actual || "Not recorded", d.emphasis?.actual);
    p("expectedLabel", "Expected Result:", {
      p: patterns.expectedLabel.p.replace("</w:pPr>", "<w:keepNext/></w:pPr>"),
    });
    text("expected", d.expected || "Not recorded", d.emphasis?.expected);
    if (d.evidence) {
      p("label", "Evidence:");
      text("expected", d.evidence);
    }
    if (i < data.defects.length - 1)
      parts.push(`<w:p>${patterns.expected.p}</w:p>`);
  });
  files["word/document.xml"] = strToU8(
    strFromU8(files["word/document.xml"]).replace(
      "<!--REPORT_CONTENT-->",
      parts.join(""),
    ),
  );
  files["word/numbering.xml"] = strToU8(numbering);
  const now = new Date().toISOString();
  files["docProps/core.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(meta.documentTitle || "Website Testing Report")}</dc:title><dc:creator>${esc(meta.tester || "TestFlow")}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
  );
  return zipSync(files, { level: 6 });
}
