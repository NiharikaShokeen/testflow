import { getWorkspaceId } from "../../../lib/visitor-workspace";
import { getDb } from "../../../db";
import { workspace } from "../../../db/schema";
import { eq } from "drizzle-orm";
export async function GET() {
  try {
    const rows = await getDb()
      .select()
      .from(workspace)
      .where(eq(workspace.id, await getWorkspaceId()));
    return Response.json(rows[0] ? JSON.parse(rows[0].payload) : null);
  } catch {
    return Response.json(
      { error: "Could not load workspace" },
      { status: 500 },
    );
  }
}
export async function PUT(r: Request) {
  try {
    const body = (await r.json()) as any;
    if (
      !body ||
      !Array.isArray(body.tests) ||
      !Array.isArray(body.runs) ||
      !Array.isArray(body.defects)
    )
      return Response.json({ error: "Invalid workspace" }, { status: 400 });
    if (
      body.reports !== undefined &&
      (!Array.isArray(body.reports) ||
        !body.reports.length ||
        body.reports.some(
          (s: any) =>
            typeof s.id !== "string" ||
            !s.meta ||
            typeof s.meta.project !== "string",
        ) ||
        new Set(body.reports.map((s: any) => s.id)).size !==
          body.reports.length)
    )
      return Response.json(
        { error: "Invalid report sessions" },
        { status: 400 },
      );
    const db = getDb();
    const rows = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, await getWorkspaceId()));
    const old = rows[0] ? JSON.parse(rows[0].payload) : {};
    const now = new Date().toISOString();
    if (body.reports === undefined && old.reports) body.reports = old.reports;
    if (body.reports) {
      body.reports = body.reports.map((s: any) => {
        const before = (old.reports || []).find((x: any) => x.id === s.id);
        return {
          ...s,
          createdAt: before
            ? before.createdAt
            : s.id === "existing-workspace"
              ? undefined
              : now,
          deletedAt: s.deletedAt ? before?.deletedAt || now : undefined,
        };
      });
    }
    body.defects = body.defects.map((d: any) => {
      const before = (old.defects || []).find((x: any) => x.id === d.id);
      return { ...d, createdAt: before ? before.createdAt : now };
    });
    const payload = JSON.stringify(body);
    if (payload.length > 2000000)
      return Response.json(
        { error: "Workspace is too large" },
        { status: 413 },
      );
    await db
      .insert(workspace)
      .values({ id: await getWorkspaceId(), payload })
      .onConflictDoUpdate({ target: workspace.id, set: { payload } });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Could not save workspace" },
      { status: 500 },
    );
  }
}
