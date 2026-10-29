import { getWorkspaceId } from "../../../lib/visitor-workspace";
import { getDb } from "../../../db";
import { workspace } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { createQaReport } from "../../../lib/qa-report";
import { createWordReport } from "../../../lib/word-report";
import { selectReport } from "../../../lib/report-sessions";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const rows = await getDb()
      .select()
      .from(workspace)
      .where(eq(workspace.id, await getWorkspaceId()));
    const saved = rows[0]
      ? JSON.parse(rows[0].payload)
      : { defects: [], runs: [] };
    let scoped;
    try {
      scoped = selectReport(saved, params.get("report"));
    } catch {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }
    const word = params.get("format") === "docx";
    const bytes = word
      ? await createWordReport(scoped.data)
      : await createQaReport(scoped.data, params.get("api") === "1");
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": word
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf",
        "Content-Disposition": `attachment; filename="TestFlow-QA-Report.${word ? "docx" : "pdf"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "The report could not be generated. Please try again." },
      { status: 500 },
    );
  }
}
