"use client";
import { useEffect, useState, useRef } from "react";
import { FindingText } from "../components/finding-text";
import type { Emphasis } from "../components/finding-text";
import { reportSessions, legacyId } from "../lib/report-sessions";
import type { ReportSession } from "../lib/report-sessions";
import {
  Activity,
  LayoutDashboard,
  ListChecks,
  Play,
  Bug,
  FileText,
  Plus,
  ArrowUpRight,
  Search,
  X,
  Check,
  Trash2,
  Pencil,
  ChevronRight,
  Download,
  FlaskConical,
} from "lucide-react";
type Test = {
  id: string;
  name: string;
  method: string;
  url: string;
  expected: number;
  body: string;
  field: string;
  value: string;
};
type Run = {
  reportId?: string;
  id: string;
  testId: string;
  name: string;
  result: string;
  actual: number | null;
  expected: number;
  ms: number;
  at: string;
  body: string;
  detail: string;
};
type Defect = {
  id: string;
  title: string;
  testId: string;
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
  reportId?: string;
  emphasis?: { steps?: Emphasis[]; actual?: Emphasis[]; expected?: Emphasis[] };
  numberSteps?: boolean;
};
type ReportMeta = {
  project: string;
  website: string;
  tester: string;
  environment: string;
  scope: string;
  testingDate?: string;
  documentTitle?: string;
  platform?: string;
  sourceDocument?: string;
};
const defaultReport: ReportMeta = {
  project: "Website review",
  website: "",
  tester: "",
  environment: "",
  scope: "",
  documentTitle: "Website Testing Report",
  platform: "",
  testingDate: "",
  sourceDocument: "",
};
const emptyDefect: Defect = {
  id: "",
  title: "",
  testId: "",
  severity: "Medium",
  status: "Open",
  website: "",
  module: "",
  steps: "",
  expected: "",
  actual: "",
  environment: "",
  evidence: "",
};
type Data = {
  tests: Test[];
  runs: Run[];
  defects: Defect[];
  report?: ReportMeta;
  reports?: ReportSession[];
};
const empty: Test = {
  id: "",
  name: "",
  method: "GET",
  url: "https://jsonplaceholder.typicode.com/posts/1",
  expected: 200,
  body: "",
  field: "",
  value: "",
};
const initial: Data = { tests: [], runs: [], defects: [] };
const sections = [
  ["Overview", LayoutDashboard],
  ["Website findings", Bug],
  ["API test cases", ListChecks],
  ["API runner", Play],
  ["Reports", FileText],
] as const;
export default function Home() {
  const [page, setPage] = useState("Overview"),
    [data, setData] = useState<Data>(initial),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState<Test | null>(null),
    [selected, setSelected] = useState<Run | null>(null),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [runner, setRunner] = useState<Test>(empty),
    [defectForm, setDefectForm] = useState<Defect | null>(null),
    [reportDraft, setReportDraft] = useState<ReportMeta>(defaultReport),
    [includeApi, setIncludeApi] = useState(false),
    [downloading, setDownloading] = useState(false),
    [deleting, setDeleting] = useState<string | null>(null),
    [activeReport, setActiveReport] = useState(legacyId),
    [newReport, setNewReport] = useState<{
      name: string;
      date: string;
      source: string;
    } | null>(null),
    [pendingCount, setPendingCount] = useState(0),
    [syncFailed, setSyncFailed] = useState(false),
    [saving, setSaving] = useState(false),
    [showTrashed, setShowTrashed] = useState(false),
    [reportToTrash, setReportToTrash] = useState<ReportSession | null>(null);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const findingQueue = useRef(Promise.resolve()),
    pendingFindings = useRef<Defect[]>([]);
  const pendingKey = "testflow-finding-drafts-v1";
  function persistPending() {
    try {
      localStorage.setItem(pendingKey, JSON.stringify(pendingFindings.current));
    } catch {}
    setPendingCount(pendingFindings.current.length);
  }
  function queueFinding(finding: Defect) {
    pendingFindings.current = [
      ...pendingFindings.current.filter((d) => d.id !== finding.id),
      finding,
    ];
    persistPending();
    setSyncFailed(false);
    setData((prev) => ({
      ...prev,
      defects: prev.defects.some((d) => d.id === finding.id)
        ? prev.defects.map((d) => (d.id === finding.id ? finding : d))
        : [...prev.defects, finding],
    }));
    findingQueue.current = findingQueue.current.then(async () => {
      const draft = pendingFindings.current.find((d) => d.id === finding.id);
      if (!draft) return;
      try {
        const r = await fetch("/api/findings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ finding: draft }),
        });
        if (!r.ok)
          throw Error(
            "Could not sync your finding. Its draft is kept on this device.",
          );
        if (pendingFindings.current.find((d) => d.id === draft.id) === draft)
          pendingFindings.current = pendingFindings.current.filter(
            (d) => d.id !== draft.id,
          );
        persistPending();
        setSyncFailed(false);
        if (!pendingFindings.current.length) {
          setError("");
          flash("Finding saved.");
        }
      } catch (e) {
        setSyncFailed(true);
        setError(
          e instanceof Error
            ? e.message
            : "Finding sync failed. Your draft is kept on this device.",
        );
      }
    });
  }
  function retryFindings() {
    for (const draft of [...pendingFindings.current]) queueFinding(draft);
  }
  const sessions = reportSessions(data),
    activeSessions = sessions.filter((r) => !r.deletedAt),
    currentSession =
      activeSessions.find((r) => r.id === activeReport) ||
      activeSessions[0] ||
      sessions[0],
    visibleDefects = data.defects.filter(
      (d) => (d.reportId || legacyId) === currentSession.id,
    ),
    visibleRuns = data.runs.filter(
      (r) => (r.reportId || legacyId) === currentSession.id,
    ),
    exportDefects = visibleDefects.filter(
      (d) => !(currentSession.excludedIds || []).includes(d.id),
    );
  function switchReport(id: string) {
    const r = sessions.find((r) => r.id === id && !r.deletedAt);
    if (r) {
      setActiveReport(id);
      setReportDraft({ ...defaultReport, ...r.meta });
      setNotice("");
      setError("");
    }
  }
  function withReportDetails() {
    return {
      ...data,
      reports: sessions.map((r) =>
        r.id === currentSession.id ? { ...r, meta: reportDraft } : r,
      ),
    };
  }
  async function downloadReport(format: "pdf" | "docx") {
    setDownloading(true);
    try {
      if (!(await save(withReportDetails()))) return;
      const r = await fetch(
        "/api/report?report=" +
          encodeURIComponent(currentSession.id) +
          "&format=" +
          format +
          (includeApi ? "&api=1" : ""),
      );
      if (!r.ok)
        throw Error("The report could not be generated. Please try again.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "TestFlow-QA-Report." + format;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash("Report downloaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }
  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => {
        if (!r.ok)
          throw Error(
            "Your workspace could not be loaded. Refresh to try again.",
          );
        return r.json() as Promise<Data | null>;
      })
      .then((d) => {
        const value = d || initial;
        const reports = reportSessions(value);
        setData({ ...value, reports });
        const first = reports.find((r) => !r.deletedAt) || reports[0];
        setActiveReport(first.id);
        setReportDraft({ ...defaultReport, ...first.meta });
        setReady(true);
        try {
          const drafts = JSON.parse(localStorage.getItem(pendingKey) || "[]");
          if (Array.isArray(drafts)) {
            for (const draft of drafts) {
              if (
                draft &&
                typeof draft.id === "string" &&
                typeof draft.title === "string"
              )
                queueFinding(draft);
            }
          }
        } catch {}
      })
      .catch((e) => setError(e.message));
  }, []);
  async function save(next: Data) {
    setError("");
    setSaving(true);
    try {
      await findingQueue.current;
      if (pendingFindings.current.length)
        throw Error(
          "A finding is waiting to sync. Use Retry before saving other changes or downloading a report.",
        );
      const r = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!r.ok)
        throw Error("Saving failed. Your last saved workspace is unchanged.");
      setData(next);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
      return false;
    } finally {
      setSaving(false);
    }
  }
  function flash(s: string) {
    setNotice(s);
    setTimeout(() => setNotice(""), 4000);
  }
  async function run(t: Test) {
    if (busy || !ready || saving) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
      const result = (await r.json()) as Run & { error?: string };
      result.reportId = currentSession.id;
      if (!r.ok) throw Error(result.error);
      await save({
        ...dataRef.current,
        runs: [result, ...dataRef.current.runs].slice(0, 300),
      });
      setSelected(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execution failed");
    } finally {
      setBusy(false);
    }
  }
  const passed = data.runs.filter((r) => r.result === "PASS").length,
    failed = data.runs.filter((r) => r.result === "FAIL").length,
    errors = data.runs.filter((r) => r.result === "ERROR").length,
    rate = data.runs.length ? Math.round((passed / data.runs.length) * 100) : 0,
    open = visibleDefects.filter((d) => d.status !== "Closed").length;
  const latest = (id: string) => data.runs.find((r) => r.testId === id);
  const badge = (s: string) => (
    <span className={"badge " + s.toLowerCase().replace(" ", "")}>{s}</span>
  );
  const go = (p: string) => {
    setPage(p);
    setQuery("");
    setFilter("All");
  };
  const demo = async () => {
    const tests = [
      {
        ...empty,
        id: crypto.randomUUID(),
        name: "Fetch an existing post",
        field: "id",
        value: "1",
      },
      {
        ...empty,
        id: crypto.randomUUID(),
        name: "Create a new post",
        method: "POST",
        url: "https://jsonplaceholder.typicode.com/posts",
        expected: 201,
        body: '{"title":"TestFlow check","body":"API smoke test","userId":1}',
      },
      {
        ...empty,
        id: crypto.randomUUID(),
        name: "Validate missing resource",
        url: "https://jsonplaceholder.typicode.com/posts/999999",
        expected: 404,
      },
    ];
    if (await save({ ...data, tests: [...data.tests, ...tests] }))
      flash(
        "Three example test cases added. Run them to collect real results.",
      );
  };
  return (
    <div className="app">
      <aside>
        <a
          className="brand"
          href="/ "
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brandmark">
            <Activity size={23} />
          </span>
          testflow<span className="branddot">.</span>
        </a>
        <div className="workspace">
          <span className="workspaceicon">T</span>
          <div>
            My workspace<small>Guest workspace</small>
          </div>
        </div>
        <div className="navlabel">WORKSPACE</div>
        <nav>
          {sections
            .filter(([s]) => !s.startsWith("API"))
            .map(([s, Icon]) => (
              <button
                key={s}
                className={page === s ? "active" : ""}
                onClick={() => go(s)}
              >
                <Icon size={18} />
                {s}
                {s === "Website findings" && open > 0 && <em>{open}</em>}
              </button>
            ))}
        </nav>
        <div className="navlabel apidemolabel">OPTIONAL API DEMO</div>
        <nav>
          {sections
            .filter(([s]) => s.startsWith("API"))
            .map(([s, Icon]) => (
              <button
                key={s}
                className={page === s ? "active" : ""}
                onClick={() => go(s)}
              >
                <Icon size={18} />
                {s}
              </button>
            ))}
        </nav>
        <div className="sidebottom">
          <div className="profile">
            <span>T</span>
            <div>
              Guest<small>This browser</small>
            </div>
            <span className="online" />
          </div>
        </div>
      </aside>
      <div className="main">
        <header>
          <span>
            Workspace <ChevronRight size={14} /> <b>{page}</b>
          </span>
          <span className="headerstatus">
            <i />{" "}
            {pendingCount
              ? syncFailed
                ? "Finding sync needs attention"
                : "Saving " +
                  pendingCount +
                  " finding" +
                  (pendingCount === 1 ? "" : "s") +
                  "…"
              : saving
                ? "Saving…"
                : ready
                  ? "All changes saved"
                  : "Loading…"}
          </span>
        </header>
        <main>
          <div className="heading">
            <div>
              <h1>{page === "Overview" ? "Review overview" : page}</h1>
              <p>
                {
                  (
                    {
                      Overview:
                        "Findings and progress for the selected review.",
                      "API test cases":
                        "Saved requests for the optional API demo.",
                      "API runner":
                        "Optional technical checks for API endpoints and their responses.",
                      "Website findings":
                        "Record what you found, how to reproduce it, and what should happen.",
                      Reports:
                        "Select findings and export your testing report.",
                    } as any
                  )[page]
                }
              </p>
            </div>
            <button
              className="primary"
              disabled={!ready || saving}
              onClick={() =>
                page === "API test cases" || page === "API runner"
                  ? setModal({ ...empty })
                  : setDefectForm({
                      ...emptyDefect,
                      reportId: currentSession.id,
                      website: currentSession.meta.website || "",
                      environment: currentSession.meta.environment || "",
                    })
              }
            >
              <Plus size={16} />
              {page === "API test cases" || page === "API runner"
                ? "New API test"
                : "Log website finding"}
            </button>
          </div>
          <div className="reportcontext">
            <label>
              Current report
              <select
                aria-label="Current report"
                value={currentSession.id}
                onChange={(e) => switchReport(e.target.value)}
              >
                {activeSessions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.meta.project}
                    {r.meta.testingDate ? " · " + r.meta.testingDate : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="reportcontextinfo">
              <strong>
                {currentSession.meta.testingDate
                  ? "Testing date: " + currentSession.meta.testingDate
                  : "Testing date not set"}
              </strong>
              <span>
                {visibleDefects.length} findings in this report · other reports
                are kept separately
              </span>
            </div>
            <button
              disabled={!ready || saving}
              onClick={() =>
                setNewReport({
                  name: "",
                  date: new Date().toLocaleDateString("en-CA", {
                    timeZone: "Asia/Kolkata",
                  }),
                  source: "",
                })
              }
            >
              <Plus size={15} />
              New report
            </button>
          </div>
          {pendingCount > 0 && (
            <div
              className={syncFailed ? "syncstatus syncerror" : "syncstatus"}
              role="status"
            >
              <span>
                {syncFailed
                  ? "Finding draft kept on this device. Sync failed."
                  : "Finding updated. Syncing in the background…"}
              </span>
              {syncFailed && (
                <button onClick={retryFindings}>Retry save</button>
              )}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={16} />
              {notice}
            </div>
          )}
          {page === "Overview" && (
            <>
              <div className="stats">
                {[
                  [
                    "Website findings",
                    visibleDefects.length,
                    "Issues recorded during website review",
                    Bug,
                  ],
                  ["Open findings", open, "Issues awaiting closure", Activity],
                  [
                    "High / critical",
                    visibleDefects.filter((d) =>
                      ["High", "Critical"].includes(d.severity),
                    ).length,
                    "Findings with higher severity",
                    FlaskConical,
                  ],
                  [
                    "Closed findings",
                    visibleDefects.filter((d) => d.status === "Closed").length,
                    "Issues marked closed after review",
                    Check,
                  ],
                ].map(([label, n, sub, Icon]: any) => (
                  <div className="stat" key={label}>
                    <div>
                      {label}
                      <Icon size={17} />
                    </div>
                    <strong>{n}</strong>
                    <small>{sub}</small>
                  </div>
                ))}
              </div>
              <div className="overviewgrid">
                <section className="panel">
                  <div className="paneltitle">
                    <div>
                      <h2>Finding status</h2>
                      <p>Progress across your website review</p>
                    </div>
                    <span className="subtle">
                      {visibleDefects.length} findings
                    </span>
                  </div>
                  <div className="chartarea">
                    <div
                      className="donut"
                      style={{
                        background: visibleDefects.length
                          ? `conic-gradient(#248575 0 ${(visibleDefects.filter((d) => d.status === "Closed").length / visibleDefects.length) * 100}%,#cf735f 0 100%)`
                          : "#edf0f1",
                      }}
                    >
                      <div>
                        <strong>
                          {visibleDefects.length
                            ? Math.round(
                                (visibleDefects.filter(
                                  (d) => d.status === "Closed",
                                ).length /
                                  visibleDefects.length) *
                                  100,
                              ) + "%"
                            : "—"}
                        </strong>
                        <small>CLOSED</small>
                      </div>
                    </div>
                    <div className="legend">
                      {[
                        ["Closed", visibleDefects.length - open, "green"],
                        ["Awaiting closure", open, "red"],
                      ].map(([l, n, c]) => (
                        <div key={l}>
                          <span>
                            <i className={String(c)} />
                            {l}
                          </span>
                          <b>{n}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="panelnote">
                    {visibleDefects.length
                      ? "Update finding status as you investigate and retest."
                      : "Log your first website finding to start your review."}
                  </div>
                </section>
                <section className="panel reviewactions">
                  <h2>Current review</h2>
                  <p>
                    Record a finding as you test the website, then select the
                    findings you need in your report.
                  </p>
                  <div className="reviewactionlist">
                    <button
                      disabled={!ready || saving}
                      onClick={() =>
                        setDefectForm({
                          ...emptyDefect,
                          reportId: currentSession.id,
                          website: currentSession.meta.website || "",
                          environment: currentSession.meta.environment || "",
                        })
                      }
                    >
                      <Plus size={16} />
                      Record a finding
                      <ChevronRight size={15} />
                    </button>
                    <button onClick={() => go("Website findings")}>
                      <Bug size={16} />
                      Review {visibleDefects.length} findings
                      <ChevronRight size={15} />
                    </button>
                    <button onClick={() => go("Reports")}>
                      <FileText size={16} />
                      Prepare Word report
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="paneltitle">
                  <div>
                    <h2>Recent website findings</h2>
                    <p>Your latest recorded issues</p>
                  </div>
                  <button
                    className="textbutton"
                    onClick={() => go("Website findings")}
                  >
                    View all <ArrowUpRight size={14} />
                  </button>
                </div>
                {visibleDefects.length ? (
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Finding</th>
                          <th>Website / page</th>
                          <th>Severity</th>
                          <th>Status</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {[...visibleDefects]
                          .reverse()
                          .slice(0, 5)
                          .map((d) => (
                            <tr key={d.id}>
                              <td>
                                <button
                                  className="findingtitle"
                                  onClick={() => setDefectForm(d)}
                                >
                                  {d.title}
                                </button>
                              </td>
                              <td>
                                <span className="websitecell">
                                  {d.website || "Not recorded"}
                                </span>
                              </td>
                              <td>{badge(d.severity)}</td>
                              <td>{badge(d.status)}</td>
                              <td>
                                <button
                                  title="View finding"
                                  onClick={() => setDefectForm(d)}
                                >
                                  <ArrowUpRight size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty">
                    <Bug />
                    <h3>Your website review starts here.</h3>
                    <p>
                      Record the first issue you observed, then build a report
                      from your findings.
                    </p>
                    <button
                      disabled={!ready || saving}
                      onClick={() =>
                        setDefectForm({
                          ...emptyDefect,
                          reportId: currentSession.id,
                        })
                      }
                    >
                      Log a website finding
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
          {page === "API test cases" && (
            <section className="panel">
              <div className="toolbar">
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="Search test cases"
                    placeholder="Search test cases…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter results"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["All", "PASS", "FAIL", "ERROR", "Not run"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <span className="subtle">{data.tests.length} test cases</span>
              </div>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Test case</th>
                      <th>Endpoint</th>
                      <th>Expected</th>
                      <th>Latest result</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tests
                      .filter(
                        (t) =>
                          (t.name + " " + t.url)
                            .toLowerCase()
                            .includes(query.toLowerCase()) &&
                          (filter === "All" ||
                            (latest(t.id)?.result || "Not run") === filter),
                      )
                      .map((t, i) => (
                        <tr key={t.id}>
                          <td>
                            <small className="id">
                              TC-{String(i + 1).padStart(3, "0")}
                            </small>
                            <strong>{t.name}</strong>
                          </td>
                          <td>
                            <span className="method">{t.method}</span>
                            <span className="endpoint" title={t.url}>
                              {new URL(t.url).pathname}
                            </span>
                          </td>
                          <td>
                            <code>{t.expected}</code>
                          </td>
                          <td>{badge(latest(t.id)?.result || "Not run")}</td>
                          <td>
                            <div className="actions">
                              <button
                                title="Run test"
                                disabled={busy}
                                onClick={() => run(t)}
                              >
                                <Play size={15} />
                              </button>
                              <button
                                title="Edit test"
                                onClick={() => setModal(t)}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                title="Delete test"
                                onClick={() => setDeleting(t.id)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!data.tests.length && (
                <div className="empty">
                  <ListChecks />
                  <h3>Your first test starts here.</h3>
                  <p>
                    Add a test case, or use examples to explore the workflow.
                  </p>
                  <button onClick={demo} disabled={!ready || saving}>
                    Add example tests
                  </button>
                </div>
              )}
            </section>
          )}
          {page === "API runner" && (
            <div className="runnergrid">
              <section className="panel">
                <div className="paneltitle">
                  <h2>Request builder</h2>
                  <span className="badge notrun">API TEST</span>
                </div>
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(runner);
                  }}
                >
                  <label>
                    Load a saved test
                    <select
                      onChange={(e) =>
                        setRunner(
                          data.tests.find((t) => t.id === e.target.value) ||
                            empty,
                        )
                      }
                      value={runner.id}
                    >
                      <option value="">Custom request</option>
                      {data.tests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {testFields(runner, setRunner)}
                  <p className="help">
                    This optional tool tests API endpoints, not full websites.
                    Supported demo API hosts: jsonplaceholder.typicode.com,
                    httpbin.org, dummyjson.com. To document a website bug, use
                    Website findings.
                  </p>
                  <button className="primary" disabled={busy || !ready}>
                    <Play size={15} />
                    {busy ? "Running request…" : "Run test"}
                  </button>
                </form>
              </section>
              <section className="panel">
                <div className="paneltitle">
                  <h2>How assertions work</h2>
                </div>
                <div className="guide">
                  <span>01</span>
                  <h3>Check the status</h3>
                  <p>The actual HTTP status must match your expected status.</p>
                  <span>02</span>
                  <h3>Check the content</h3>
                  <p>
                    Optionally check a JSON field using a dot path, such as
                    user.id. Enter the expected value below it.
                  </p>
                  <span>03</span>
                  <h3>Inspect and follow up</h3>
                  <p>
                    View the response and timing. If a check fails, create a
                    linked defect from the result.
                  </p>
                </div>
              </section>
            </div>
          )}
          {page === "API runner" && (
            <section className="panel" style={{ marginTop: 24 }}>
              <div className="paneltitle">
                <h2>API execution history</h2>
                <span className="subtle">{visibleRuns.length} executions</span>
              </div>
              {runsTable(visibleRuns)}
            </section>
          )}
          {page === "Website findings" && (
            <section className="panel">
              <div className="paneltitle">
                <div>
                  <h2>Website findings</h2>
                  <p>
                    {open} open · {visibleDefects.length} total · record issues
                    for any website
                  </p>
                </div>
                <button
                  disabled={!ready || saving}
                  onClick={() =>
                    setDefectForm({
                      ...emptyDefect,
                      reportId: currentSession.id,
                      website: currentSession.meta.website || "",
                      environment: currentSession.meta.environment || "",
                    })
                  }
                >
                  <Plus size={15} />
                  Log finding
                </button>
              </div>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Finding</th>
                      <th>Website / page</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDefects.map((d, i) => (
                      <tr key={d.id}>
                        <td>
                          <small className="id">
                            BUG-{String(i + 1).padStart(3, "0")}
                          </small>
                          <button
                            className="findingtitle"
                            onClick={() => setDefectForm(d)}
                          >
                            {d.title}
                          </button>
                          <small>{d.module || "Website issue"}</small>
                        </td>
                        <td>
                          <span className="websitecell" title={d.website}>
                            {d.website || "Not recorded"}
                          </span>
                        </td>
                        <td>{badge(d.severity)}</td>
                        <td>
                          <select
                            disabled={saving}
                            aria-label={"Status for " + d.title}
                            value={d.status}
                            onChange={(e) =>
                              queueFinding({ ...d, status: e.target.value })
                            }
                          >
                            {[
                              "Open",
                              "In Progress",
                              "Resolved",
                              "Closed",
                              "Reopened",
                            ].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            title="View or edit finding"
                            onClick={() => setDefectForm(d)}
                          >
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!visibleDefects.length && (
                <div className="empty">
                  <Bug />
                  <h3>Record your first website finding.</h3>
                  <p>
                    Broken buttons, incorrect messages, layout issues, or
                    unexpected behaviour—all belong here.
                  </p>
                </div>
              )}
            </section>
          )}
          {page === "Reports" && (
            <>
              <div className="reportlayout">
                <section className="panel">
                  <div className="paneltitle">
                    <div>
                      <h2>Report details</h2>
                      <p>
                        Describe the website and review covered by this report.
                      </p>
                    </div>
                  </div>
                  <form
                    className="form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await save(withReportDetails()))
                        flash("Report details saved.");
                    }}
                  >
                    <label>
                      Project / website name
                      <input
                        required
                        maxLength={150}
                        value={reportDraft.project}
                        onChange={(e) =>
                          setReportDraft({
                            ...reportDraft,
                            project: e.target.value,
                          })
                        }
                        placeholder="e.g. Zuka website QA review"
                      />
                    </label>
                    <label>
                      Document title
                      <input
                        maxLength={150}
                        value={reportDraft.documentTitle || ""}
                        onChange={(e) =>
                          setReportDraft({
                            ...reportDraft,
                            documentTitle: e.target.value,
                          })
                        }
                        placeholder="Zuka Testing Report"
                      />
                    </label>
                    <div className="fieldrow">
                      <label>
                        Testing date
                        <input
                          type="date"
                          value={reportDraft.testingDate || ""}
                          onChange={(e) =>
                            setReportDraft({
                              ...reportDraft,
                              testingDate: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Platform
                        <input
                          maxLength={150}
                          value={reportDraft.platform || ""}
                          onChange={(e) =>
                            setReportDraft({
                              ...reportDraft,
                              platform: e.target.value,
                            })
                          }
                          placeholder="Zuka web Application"
                        />
                      </label>
                    </div>
                    <label>
                      Website URL
                      <input
                        type="url"
                        value={reportDraft.website}
                        onChange={(e) =>
                          setReportDraft({
                            ...reportDraft,
                            website: e.target.value,
                          })
                        }
                        placeholder="https://example.com"
                      />
                    </label>
                    <div className="fieldrow">
                      <label>
                        Prepared by
                        <input
                          maxLength={100}
                          value={reportDraft.tester}
                          onChange={(e) =>
                            setReportDraft({
                              ...reportDraft,
                              tester: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Browser / device
                        <input
                          maxLength={200}
                          value={reportDraft.environment}
                          onChange={(e) =>
                            setReportDraft({
                              ...reportDraft,
                              environment: e.target.value,
                            })
                          }
                          placeholder="Chrome · macOS · Desktop"
                        />
                      </label>
                    </div>
                    <label>
                      Review scope
                      <textarea
                        maxLength={4000}
                        rows={4}
                        value={reportDraft.scope}
                        onChange={(e) =>
                          setReportDraft({
                            ...reportDraft,
                            scope: e.target.value,
                          })
                        }
                        placeholder="e.g. Reviewed registration, login, navigation and mobile layout. Payment flows were outside this review."
                      />
                    </label>
                    <label>
                      Source document reference (optional)
                      <input
                        maxLength={200}
                        value={reportDraft.sourceDocument || ""}
                        onChange={(e) =>
                          setReportDraft({
                            ...reportDraft,
                            sourceDocument: e.target.value,
                          })
                        }
                        placeholder="Filename of an original historical report"
                      />
                      <small>
                        Identify the original report when recording historical
                        testing. Testing date and TestFlow entry date are
                        tracked separately.
                      </small>
                    </label>
                    <button disabled={!ready || saving}>
                      {saving ? "Saving…" : "Save report details"}
                    </button>
                  </form>
                </section>
                <section className="panel reportdownload">
                  <span className="kicker">READY TO SHARE</span>
                  <h2>Export current report</h2>
                  <p>
                    Download an editable testing report with reproduction steps,
                    observed results and expected results. Each review keeps its
                    own findings and testing date.
                  </p>
                  <div className="reportcounts">
                    <div>
                      <strong>{exportDefects.length}</strong>
                      <span>Selected</span>
                    </div>
                    <div>
                      <strong>
                        {
                          exportDefects.filter((d) => d.status !== "Closed")
                            .length
                        }
                      </strong>
                      <span>Open selected</span>
                    </div>
                    <div>
                      <strong>
                        {
                          exportDefects.filter((d) =>
                            ["High", "Critical"].includes(d.severity),
                          ).length
                        }
                      </strong>
                      <span>High / critical selected</span>
                    </div>
                  </div>
                  <label className="checkline">
                    <input
                      type="checkbox"
                      checked={includeApi}
                      onChange={(e) => setIncludeApi(e.target.checked)}
                    />
                    Include automated API results in PDF appendix
                  </label>
                  <button
                    className="primary"
                    disabled={!ready || downloading || saving}
                    onClick={() => downloadReport("docx")}
                  >
                    <Download size={16} />
                    {downloading
                      ? "Preparing document…"
                      : "Download Word report"}
                  </button>
                  <button
                    className="pdfsecondary"
                    disabled={!ready || downloading || saving}
                    onClick={() => downloadReport("pdf")}
                  >
                    <FileText size={16} />
                    Download PDF report
                  </button>
                  <p className="help">
                    Word export uses your original headings: Steps to Reproduce,
                    Observed Result, Expected Result. Text is copied as entered;
                    add screenshots in Word or Pages. API appendices are
                    available in PDF only.
                  </p>
                  <button
                    className="textbutton"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(data, null, 2)], {
                        type: "application/json",
                      });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = "testflow-backup.json";
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                  >
                    Export workspace backup
                  </button>
                </section>
              </div>
              <section className="panel reportcontents">
                <div className="paneltitle">
                  <div>
                    <h2>Choose findings for export</h2>
                    <p>
                      {exportDefects.length} of {visibleDefects.length}{" "}
                      selected. Deselecting keeps the finding in your report
                      history.
                    </p>
                  </div>
                </div>
                {visibleDefects.length ? (
                  <div className="exportselection">
                    {visibleDefects.map((d) => (
                      <label className="checkline" key={d.id}>
                        <input
                          type="checkbox"
                          checked={
                            !(currentSession.excludedIds || []).includes(d.id)
                          }
                          onChange={async (e) => {
                            const excluded = new Set(
                              currentSession.excludedIds || [],
                            );
                            if (e.target.checked) excluded.delete(d.id);
                            else excluded.add(d.id);
                            await save({
                              ...data,
                              reports: sessions.map((r) =>
                                r.id === currentSession.id
                                  ? { ...r, excludedIds: [...excluded] }
                                  : r,
                              ),
                            });
                          }}
                        />
                        <span>
                          {d.title}
                          <small>
                            {d.status} · {d.severity}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <p>
                      No findings in this report yet. Log a finding to include
                      it here.
                    </p>
                  </div>
                )}
              </section>
              <section className="panel reportcontents">
                <div className="paneltitle">
                  <h2>Report library</h2>
                  <label className="checkline trashfilter">
                    <input
                      type="checkbox"
                      checked={showTrashed}
                      onChange={(e) => setShowTrashed(e.target.checked)}
                    />
                    Show trash ({sessions.filter((r) => r.deletedAt).length})
                  </label>
                </div>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Report</th>
                        <th>Testing date</th>
                        <th>Recorded in TestFlow</th>
                        <th>Findings</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions
                        .filter((r) =>
                          showTrashed ? !!r.deletedAt : !r.deletedAt,
                        )
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button
                                disabled={!!r.deletedAt}
                                className="findingtitle"
                                onClick={() => switchReport(r.id)}
                              >
                                {r.meta.project}
                              </button>
                              <small>
                                {r.meta.sourceDocument || "No source reference"}
                              </small>
                            </td>
                            <td>{r.meta.testingDate || "Not recorded"}</td>
                            <td>
                              {r.createdAt
                                ? new Date(r.createdAt).toLocaleDateString(
                                    "en-IN",
                                  )
                                : "Existing workspace"}
                            </td>
                            <td>
                              {
                                data.defects.filter(
                                  (d) => (d.reportId || legacyId) === r.id,
                                ).length
                              }
                            </td>
                            <td>
                              {r.deletedAt ? (
                                <button
                                  disabled={saving}
                                  onClick={async () => {
                                    if (
                                      await save({
                                        ...data,
                                        reports: sessions.map((x) =>
                                          x.id === r.id
                                            ? { ...x, deletedAt: undefined }
                                            : x,
                                        ),
                                      })
                                    )
                                      flash("Report restored.");
                                  }}
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  disabled={saving}
                                  title={"Move " + r.meta.project + " to trash"}
                                  onClick={() => setReportToTrash(r)}
                                >
                                  <Trash2 size={15} />
                                  Move to trash
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel reportcontents">
                <div className="paneltitle">
                  <h2>PDF report structure</h2>
                  <span className="subtle">
                    Selected findings from the current report
                  </span>
                </div>
                <div className="reportoutline">
                  <div>
                    <b>01 / Review overview</b>
                    <p>Website, tester, environment, scope and issue counts.</p>
                  </div>
                  <div>
                    <b>02 / Findings register</b>
                    <p>Issue ID, summary, severity and current status.</p>
                  </div>
                  <div>
                    <b>03 / Detailed findings</b>
                    <p>
                      Page URL, reproduction steps, expected and actual results,
                      and evidence references.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
          <footer>
            <span>TestFlow · QA records</span>
            <span>Guest workspace · export a backup before clearing cookies</span>
          </footer>
        </main>
      </div>
      {modal && (
        <div className="overlay">
          <section className="dialog">
            <div className="paneltitle">
              <div>
                <h2>{modal.id ? "Edit test case" : "New test case"}</h2>
                <p>Give your next check a clear purpose.</p>
              </div>
              <button aria-label="Close" onClick={() => setModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const t = { ...modal, id: modal.id || crypto.randomUUID() };
                if (
                  await save({
                    ...data,
                    tests: modal.id
                      ? data.tests.map((x) => (x.id === t.id ? t : x))
                      : [...data.tests, t],
                  })
                ) {
                  setModal(null);
                  flash("Test case saved.");
                }
              }}
            >
              <label>
                Test case name
                <input
                  required
                  maxLength={150}
                  placeholder="e.g. Fetch an existing user"
                  value={modal.name}
                  onChange={(e) => setModal({ ...modal, name: e.target.value })}
                />
              </label>
              {testFields(modal, setModal)}
              <button className="primary">Save test case</button>
            </form>
          </section>
        </div>
      )}
      {selected && (
        <div className="overlay">
          <section className="dialog wide">
            <div className="paneltitle">
              <div>
                <h2>{selected.name || "Custom request"}</h2>
                <p>Executed {new Date(selected.at).toLocaleString()}</p>
              </div>
              <button
                aria-label="Close result"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="resultbody">
              <div className="resultmeta">
                {badge(selected.result)}
                <span>
                  Status <b>{selected.actual ?? "—"}</b>
                </span>
                <span>
                  Expected <b>{selected.expected}</b>
                </span>
                <span>
                  <b>{selected.ms}</b> ms
                </span>
              </div>
              <p>{selected.detail}</p>
              <h3>Response body</h3>
              <pre>{selected.body || "No response received."}</pre>
              {selected.result !== "PASS" && (
                <button
                  onClick={async () => {
                    if (
                      await save({
                        ...data,
                        defects: [
                          ...data.defects,
                          {
                            id: crypto.randomUUID(),
                            title:
                              (selected.name || "API request") +
                              ": " +
                              selected.detail,
                            testId: selected.testId,
                            reportId: currentSession.id,
                            severity: "Medium",
                            status: "Open",
                            website:
                              data.tests.find((t) => t.id === selected.testId)
                                ?.url || "",
                            expected: "HTTP " + selected.expected,
                            actual:
                              "HTTP " +
                              (selected.actual ?? "no response") +
                              ": " +
                              selected.detail,
                            steps: "Run the linked API test.",
                            module: "API",
                            createdAt: new Date().toISOString(),
                          },
                        ],
                      })
                    ) {
                      setSelected(null);
                      go("Website findings");
                      flash("Linked defect created.");
                    }
                  }}
                >
                  <Bug size={15} />
                  Create linked defect
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {defectForm && (
        <div className="overlay">
          <section className="dialog wide">
            <div className="paneltitle">
              <div>
                <h2>
                  {defectForm.id ? "Finding details" : "Log a website finding"}
                </h2>
                <p>Record an issue you observed on any website.</p>
              </div>
              <button onClick={() => setDefectForm(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                const d = {
                  ...defectForm,
                  reportId: defectForm.reportId || currentSession.id,
                  id: defectForm.id || crypto.randomUUID(),
                  createdAt: defectForm.createdAt || new Date().toISOString(),
                };
                queueFinding(d);
                setDefectForm(null);
              }}
            >
              <label>
                Issue summary
                <input
                  value={defectForm.title}
                  onChange={(e) =>
                    setDefectForm({ ...defectForm, title: e.target.value })
                  }
                  required
                  maxLength={200}
                  placeholder="e.g. Login button does nothing after entering valid details"
                />
              </label>
              <label>
                Website / affected page URL
                <input
                  type="url"
                  value={defectForm.website || ""}
                  onChange={(e) =>
                    setDefectForm({ ...defectForm, website: e.target.value })
                  }
                  placeholder="https://example.com/login"
                />
                <small>
                  Any website URL is accepted here. This records the page; it
                  does not run an automated request.
                </small>
              </label>
              <div className="fieldrow">
                <label>
                  Feature / module
                  <input
                    maxLength={150}
                    value={defectForm.module || ""}
                    onChange={(e) =>
                      setDefectForm({ ...defectForm, module: e.target.value })
                    }
                    placeholder="e.g. Login"
                  />
                </label>
                <label>
                  Browser / device
                  <input
                    maxLength={200}
                    value={defectForm.environment || ""}
                    onChange={(e) =>
                      setDefectForm({
                        ...defectForm,
                        environment: e.target.value,
                      })
                    }
                    placeholder="Chrome · macOS · Desktop"
                  />
                </label>
              </div>
              <FindingText
                label="Steps to reproduce"
                value={defectForm.steps || ""}
                spans={defectForm.emphasis?.steps}
                onChange={(value) =>
                  setDefectForm({
                    ...defectForm,
                    steps: value,
                    emphasis: { ...defectForm.emphasis, steps: [] },
                  })
                }
                onFormat={(spans) =>
                  setDefectForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          emphasis: { ...prev.emphasis, steps: spans },
                        }
                      : prev,
                  )
                }
                placeholder={
                  "1. Open the login page.\n2. Enter test credentials.\n3. Click Log in."
                }
              />
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={defectForm.numberSteps !== false}
                  onChange={(e) =>
                    setDefectForm({
                      ...defectForm,
                      numberSteps: e.target.checked,
                    })
                  }
                />
                Number the steps in Word
              </label>
              <div className="fieldrow">
                <FindingText
                  label="Expected result"
                  rows={3}
                  value={defectForm.expected || ""}
                  spans={defectForm.emphasis?.expected}
                  onChange={(value) =>
                    setDefectForm({
                      ...defectForm,
                      expected: value,
                      emphasis: { ...defectForm.emphasis, expected: [] },
                    })
                  }
                  onFormat={(spans) =>
                    setDefectForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            emphasis: { ...prev.emphasis, expected: spans },
                          }
                        : prev,
                    )
                  }
                  placeholder="What should happen?"
                />
                <FindingText
                  label="Observed result"
                  rows={3}
                  value={defectForm.actual || ""}
                  spans={defectForm.emphasis?.actual}
                  onChange={(value) =>
                    setDefectForm({
                      ...defectForm,
                      actual: value,
                      emphasis: { ...defectForm.emphasis, actual: [] },
                    })
                  }
                  onFormat={(spans) =>
                    setDefectForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            emphasis: { ...prev.emphasis, actual: spans },
                          }
                        : prev,
                    )
                  }
                  placeholder="What happened instead?"
                />
              </div>
              <div className="fieldrow">
                <label>
                  Severity
                  <select
                    value={defectForm.severity}
                    onChange={(e) =>
                      setDefectForm({ ...defectForm, severity: e.target.value })
                    }
                  >
                    {["Low", "Medium", "High", "Critical"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={defectForm.status}
                    onChange={(e) =>
                      setDefectForm({ ...defectForm, status: e.target.value })
                    }
                  >
                    {[
                      "Open",
                      "In Progress",
                      "Resolved",
                      "Closed",
                      "Reopened",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Evidence reference (optional)
                <input
                  maxLength={1000}
                  value={defectForm.evidence || ""}
                  onChange={(e) =>
                    setDefectForm({ ...defectForm, evidence: e.target.value })
                  }
                  placeholder="Link to a screenshot or recording, or its filename"
                />
                <small>
                  Paste a reference to your evidence. Files are not uploaded
                  through this field.
                </small>
              </label>
              <button className="primary" disabled={saving}>
                Save finding
              </button>
            </form>
          </section>
        </div>
      )}
      {newReport && (
        <div className="overlay">
          <section className="dialog">
            <div className="paneltitle">
              <div>
                <h2>Start a separate report</h2>
                <p>
                  Start with no findings. All previous reports remain saved.
                </p>
              </div>
              <button
                aria-label="Close new report"
                onClick={() => setNewReport(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const r: ReportSession = {
                  id: crypto.randomUUID(),
                  createdAt: new Date().toISOString(),
                  meta: {
                    ...defaultReport,
                    project: newReport.name,
                    testingDate: newReport.date,
                    sourceDocument: newReport.source,
                  },
                };
                if (await save({ ...data, reports: [...sessions, r] })) {
                  setActiveReport(r.id);
                  setReportDraft({ ...defaultReport, ...r.meta });
                  setNewReport(null);
                  go("Website findings");
                  flash(
                    "New report created. Previous findings remain in their original report.",
                  );
                }
              }}
            >
              <label>
                Report name
                <input
                  required
                  maxLength={150}
                  value={newReport.name}
                  onChange={(e) =>
                    setNewReport({ ...newReport, name: e.target.value })
                  }
                  placeholder="e.g. Zuka NGO review — 4 August"
                />
              </label>
              <label>
                Testing date
                <input
                  type="date"
                  required
                  value={newReport.date}
                  onChange={(e) =>
                    setNewReport({ ...newReport, date: e.target.value })
                  }
                />
              </label>
              <label>
                Original source document (optional)
                <input
                  maxLength={200}
                  value={newReport.source}
                  onChange={(e) =>
                    setNewReport({ ...newReport, source: e.target.value })
                  }
                  placeholder="For historical work, enter the original report filename"
                />
              </label>
              <p className="help">
                Testing date is the date of the review. The entry date is
                recorded automatically. For a historical review, copy the
                findings and testing date from your original report.
              </p>
              <button className="primary">Create report</button>
            </form>
          </section>
        </div>
      )}
      {reportToTrash && (
        <div className="overlay">
          <section className="dialog">
            <div className="form">
              <h2>Move this report to trash?</h2>
              <p>
                {reportToTrash.meta.project} and its findings will be hidden
                from the active reports. You can restore it from the report
                library.
              </p>
              <div className="actions">
                <button onClick={() => setReportToTrash(null)}>Cancel</button>
                <button
                  className="danger"
                  disabled={saving}
                  onClick={async () => {
                    let next = sessions.map((r) =>
                      r.id === reportToTrash.id
                        ? { ...r, deletedAt: new Date().toISOString() }
                        : r,
                    );
                    let active = next.find((r) => !r.deletedAt);
                    if (!active) {
                      active = {
                        id: crypto.randomUUID(),
                        createdAt: new Date().toISOString(),
                        meta: { ...defaultReport, project: "Untitled review" },
                      };
                      next = [...next, active];
                    }
                    if (await save({ ...data, reports: next })) {
                      if (currentSession.id === reportToTrash.id) {
                        setActiveReport(active.id);
                        setReportDraft({ ...defaultReport, ...active.meta });
                      }
                      setReportToTrash(null);
                      flash("Report moved to trash.");
                    }
                  }}
                >
                  Move to trash
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {deleting && (
        <div className="overlay">
          <section className="dialog">
            <div className="form">
              <h2>Delete this test case?</h2>
              <p>Execution history and linked defects will be retained.</p>
              <div className="actions">
                <button onClick={() => setDeleting(null)}>Cancel</button>
                <button
                  className="danger"
                  onClick={async () => {
                    if (
                      await save({
                        ...data,
                        tests: data.tests.filter((t) => t.id !== deleting),
                      })
                    )
                      setDeleting(null);
                  }}
                >
                  Delete test case
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
  function runsTable(rows: Run[]) {
    return rows.length ? (
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Test case</th>
              <th>Result</th>
              <th>HTTP status</th>
              <th>Duration</th>
              <th>Executed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="clickrow"
              >
                <td>
                  <strong>{r.name || "Custom request"}</strong>
                </td>
                <td>{badge(r.result)}</td>
                <td>
                  <code>{r.actual ?? "—"}</code>
                </td>
                <td>
                  {r.ms} <small>ms</small>
                </td>
                <td className="subtle">
                  {new Date(r.at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td>
                  <button
                    title="View response"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(r);
                    }}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="empty">
        <Activity />
        <h3>No executions yet.</h3>
        <p>Run a test to capture your first result.</p>
        <button onClick={() => go("API runner")}>
          Open test runner <ArrowUpRight size={14} />
        </button>
      </div>
    );
  }
  function testFields(t: Test, set: (v: Test) => void) {
    return (
      <>
        <div className="fieldrow">
          <label className="short">
            Method
            <select
              value={t.method}
              onChange={(e) => set({ ...t, method: e.target.value })}
            >
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Endpoint URL
            <input
              required
              type="url"
              value={t.url}
              onChange={(e) => set({ ...t, url: e.target.value })}
            />
          </label>
        </div>
        <label>
          Expected HTTP status
          <input
            required
            type="number"
            min="100"
            max="599"
            value={t.expected}
            onChange={(e) => set({ ...t, expected: Number(e.target.value) })}
          />
        </label>
        {t.method !== "GET" && (
          <label>
            Request body (JSON data)
            <textarea
              rows={4}
              value={t.body}
              onChange={(e) => set({ ...t, body: e.target.value })}
              placeholder='{"title":"Hello"}'
            />
          </label>
        )}
        <div className="formdivider">OPTIONAL API RESPONSE CHECK</div>
        <div className="fieldrow">
          <label>
            Response field path
            <input
              placeholder="e.g. user.id"
              value={t.field}
              onChange={(e) => set({ ...t, field: e.target.value })}
            />
          </label>
          <label>
            Expected value
            <input
              placeholder="e.g. 1"
              value={t.value}
              onChange={(e) => set({ ...t, value: e.target.value })}
            />
          </label>
        </div>
      </>
    );
  }
}
