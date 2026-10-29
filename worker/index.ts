import handler from "vinext/server/fetch-handler";

const COOKIE = "testflow_session";
const SESSION_HEADER = "x-testflow-workspace";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const asset = url.pathname.startsWith("/_next/static/") || url.pathname === "/favicon.svg";
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    let body: Uint8Array | undefined;
    if (mutation && request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        size += result.value.length;
        if (size > 2_000_000) {
          await reader.cancel();
          return Response.json({ error: "Request is too large." }, { status: 413 });
        }
        chunks.push(result.value);
      }
      body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    }
    const origin = request.headers.get("Origin");
    if (mutation && origin && origin !== url.origin) {
      return Response.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
    }
    const incoming = request.headers.get("Cookie")?.split(";")
      .map((entry) => entry.trim()).find((entry) => entry.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    const valid = incoming && /^[a-f0-9]{64}$/.test(incoming);
    const session = valid ? incoming : Array.from(crypto.getRandomValues(new Uint8Array(32)),
      (byte) => byte.toString(16).padStart(2, "0")).join("");
    const headers = new Headers(request.headers);
    // Never trust a visitor-supplied workspace header.
    headers.set(SESSION_HEADER, `guest:${session}`);
    const response = await handler.fetch(new Request(request, { headers, ...(body ? { body: body as BodyInit } : {}) }), env, ctx);
    const responseHeaders = new Headers(response.headers);
    if (!valid && !asset) {
      responseHeaders.append("Set-Cookie", `${COOKIE}=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${url.protocol === "https:" ? "; Secure" : ""}`);
    }
    if (url.pathname.startsWith("/api/")) responseHeaders.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
  },
};
