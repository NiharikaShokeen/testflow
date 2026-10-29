export type ReportMeta = {
  project: string;
  website: string;
  tester: string;
  environment: string;
  scope: string;
  documentTitle?: string;
  platform?: string;
  testingDate?: string;
  sourceDocument?: string;
};
export type ReportSession = {
  id: string;
  meta: ReportMeta;
  createdAt?: string;
  excludedIds?: string[];
  deletedAt?: string;
};
export const legacyId = "existing-workspace";
export function reportSessions(data: any): ReportSession[] {
  return Array.isArray(data.reports) && data.reports.length
    ? data.reports
    : [
        {
          id: legacyId,
          meta: {
            project: "Existing findings",
            website: "",
            tester: "",
            environment: "",
            scope: "",
            ...data.report,
          },
        },
      ];
}
export function selectReport(data: any, id: string | null) {
  const sessions = reportSessions(data);
  const session = id
    ? sessions.find((s) => s.id === id && !s.deletedAt)
    : sessions.find((s) => !s.deletedAt);
  if (!session) throw Error("Report not found");
  const excluded = new Set(session.excludedIds || []);
  return {
    session,
    data: {
      ...data,
      report: session.meta,
      defects: (data.defects || []).filter(
        (d: any) =>
          (d.reportId || legacyId) === session.id && !excluded.has(d.id),
      ),
      runs: (data.runs || []).filter(
        (r: any) => (r.reportId || legacyId) === session.id,
      ),
    },
  };
}
