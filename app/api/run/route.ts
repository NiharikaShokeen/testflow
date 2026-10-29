export async function POST(r: Request) {
  try {
    const t = (await r.json()) as {
      id: string;
      name: string;
      url: string;
      method: string;
      expected: number;
      body: string;
      field: string;
      value: string;
    };
    if (
      !t ||
      typeof t.url !== "string" ||
      !Number.isInteger(Number(t.expected)) ||
      Number(t.expected) < 100 ||
      Number(t.expected) > 599
    )
      return Response.json(
        { error: "Invalid test configuration" },
        { status: 400 },
      );
    const url = new URL(t.url);
    const allowed = [
      "jsonplaceholder.typicode.com",
      "httpbin.org",
      "dummyjson.com",
    ];
    if (
      url.protocol !== "https:" ||
      !allowed.includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      return Response.json(
        {
          error:
            "This is the optional API runner. It supports HTTPS endpoints on jsonplaceholder.typicode.com, httpbin.org, or dummyjson.com. To record a bug on another website, open Website findings and log the affected page there.",
        },
        { status: 400 },
      );
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(t.method))
      return Response.json({ error: "Unsupported method" }, { status: 400 });
    let body;
    if (t.body && t.method !== "GET") {
      body = JSON.stringify(JSON.parse(t.body));
    }
    const start = performance.now();
    try {
      const res = await fetch(url, {
        method: t.method,
        headers: { "Content-Type": "application/json" },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      if (res.status >= 300 && res.status < 400)
        throw new Error(
          "Redirects are not allowed. Use the final API endpoint.",
        );
      const reader = res.body?.getReader();
      let content = "",
        size = 0;
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 100000) {
            await reader.cancel();
            content += "\n[Response truncated]";
            break;
          }
          content += decoder.decode(value, { stream: true });
        }
      }
      const statusOk = res.status === Number(t.expected);
      let assertionOk = true;
      if (t.field) {
        try {
          let val = JSON.parse(content);
          for (const part of t.field.split(".")) val = val?.[part];
          assertionOk =
            JSON.stringify(val) === t.value || String(val) === t.value;
        } catch {
          assertionOk = false;
        }
      }
      return Response.json({
        id: crypto.randomUUID(),
        testId: t.id,
        name: t.name,
        result: statusOk && assertionOk ? "PASS" : "FAIL",
        actual: res.status,
        expected: Number(t.expected),
        ms: Math.round(performance.now() - start),
        at: new Date().toISOString(),
        body: content,
        detail: !statusOk
          ? "Unexpected HTTP status"
          : !assertionOk
            ? "Response assertion failed"
            : "All assertions passed",
      });
    } catch (e) {
      return Response.json({
        id: crypto.randomUUID(),
        testId: t.id,
        name: t.name,
        result: "ERROR",
        actual: null,
        expected: Number(t.expected),
        ms: Math.round(performance.now() - start),
        at: new Date().toISOString(),
        body: "",
        detail: e instanceof Error ? e.message : "Request failed",
      });
    }
  } catch {
    return Response.json(
      { error: "Check the URL and JSON request body." },
      { status: 400 },
    );
  }
}
