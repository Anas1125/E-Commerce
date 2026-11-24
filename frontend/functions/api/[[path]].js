// Same-origin API gateway. Never forward arbitrary client headers or redirects.
const API = "https://e-commerce-api-lac-psi.vercel.app";
const requestHeaders = ["accept", "content-type", "origin", "x-session-role"];
const responseHeaders = ["content-type", "retry-after", "x-total-count"];

export async function onRequest({ request, env }) {
  const secret = env.STORE_PROXY_SECRET;
  if (!secret || secret.length < 32) {
    return new Response(JSON.stringify({ detail: "API proxy is not configured" }), {
      status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith("/api/") || incoming.pathname.startsWith("/api/cron/")) {
    return new Response("Not found", { status: 404 });
  }
  const target = new URL(API);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const cookies = (request.headers.get("cookie") || "").split(";").map(x => x.trim())
    .filter(x => /^__Host-store-(customer|admin)=/.test(x)).join("; ");
  if (cookies) headers.set("cookie", cookies);
  headers.set("x-store-proxy-secret", secret);
  headers.set("x-store-client-ip", request.headers.get("CF-Connecting-IP") || "");
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });
    const result = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value) result.set(name, value);
    }
    // Cloudflare Headers supports getAll for Set-Cookie.
    const setCookies = typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie() : upstream.headers.getAll("Set-Cookie");
    for (const cookie of setCookies) {
      result.append("Set-Cookie", cookie);
    }
    const location = upstream.headers.get("location");
    if (location && upstream.status >= 300 && upstream.status < 400) {
      const redirect = new URL(location, target);
      if (redirect.origin !== target.origin || !redirect.pathname.startsWith("/api/")) {
        return new Response("Unexpected API redirect", { status: 502 });
      }
      result.set("Location", redirect.pathname + redirect.search);
    }
    return new Response(upstream.body, { status: upstream.status, headers: result });
  } catch {
    return new Response(JSON.stringify({ detail: "API temporarily unavailable" }), {
      status: 502, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
