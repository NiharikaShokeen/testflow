import { getWorkspaceId } from "../../../lib/visitor-workspace";
import { env } from "cloudflare:workers";
export async function PATCH(request: Request) {
  try {
    const { finding } = (await request.json()) as { finding: any };
    if (
      !finding ||
      typeof finding.id !== "string" ||
      !finding.id ||
      typeof finding.title !== "string" ||
      !finding.title.trim() ||
      finding.title.length > 200 ||
      !["Low", "Medium", "High", "Critical"].includes(finding.severity) ||
      !["Open", "In Progress", "Resolved", "Closed", "Reopened"].includes(
        finding.status,
      )
    )
      return Response.json(
        { error: "Check the finding title, severity and status." },
        { status: 400 },
      );
    const now = new Date().toISOString();
    const record = { ...finding, createdAt: now };
    const encoded = JSON.stringify(record);
    if (encoded.length > 60000)
      return Response.json(
        { error: "This finding is too large to save." },
        { status: 413 },
      );
    // Replace only the matching record, in one atomic write. Other reports and findings are untouched.
    if (!env.DB) throw Error("Database unavailable");
    const result = await env.DB.prepare(
      `INSERT INTO workspace(id,payload)
    VALUES(?,json_object('tests',json('[]'),'runs',json('[]'),'defects',json_array(json(?))))
    ON CONFLICT(id) DO UPDATE SET payload=json_set(workspace.payload,'$.defects',json(
      CASE WHEN EXISTS(SELECT 1 FROM json_each(COALESCE(json_extract(workspace.payload,'$.defects'),'[]')) WHERE json_extract(value,'$.id')=?)
      THEN (SELECT json_group_array(json(CASE WHEN json_extract(value,'$.id')=?
          THEN json_set(?,'$.createdAt',json_extract(value,'$.createdAt')) ELSE value END))
          FROM json_each(COALESCE(json_extract(workspace.payload,'$.defects'),'[]')))
      ELSE json_insert(COALESCE(json_extract(workspace.payload,'$.defects'),'[]'),'$[#]',json(?)) END))`,
    )
      .bind(await getWorkspaceId(), encoded, finding.id, finding.id, encoded, encoded)
      .run();
    if (!result.success) throw Error("Save failed");
    return Response.json({ ok: true, savedAt: now });
  } catch {
    return Response.json(
      {
        error:
          "Could not save the finding. Your draft is kept on this device; retry when connected.",
      },
      { status: 500 },
    );
  }
}
