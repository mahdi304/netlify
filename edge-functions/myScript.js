const TARGET_URL = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

const STRIP_HEAD = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handler(request) {
  if (!TARGET_URL) {
    return new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const targetUrl = TARGET_URL + url.pathname + url.search;

    const headers = new Headers();
    let userIp = null;

    for (const [key, value] of request.headers) {
      const KE = key.toLowerCase();
      if (STRIP_HEAD(k)) continue;
      if (KE.startsWith("x-nf-")) continue;
      if (KE.startsWith("x-netlify-")) continue;
      if (KE === "x-real-ip") {
        userIp = value;
        continue;
      }
      if (KE === "x-forwarded-for") {
        if (!userIp) userIp = value;
        continue;
      }
      headers.set(KE, value);
    }

    if (userIp) headers.set("x-forwarded-for", userIp);

    const method = request.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    const fetchOptions = {
      method,
      headers,
      redirect: "manual",
    };

    if (hasBody) {
      fetchOptions.body = request.body;
    }

    const upstream = await fetch(targetUrl, fetchOptions);

    const responseHeaders = new Headers();
    for (const [key, value] of upstream.headers) {
      if (key.toLowerCase() === "transfer-encoding") continue;
      responseHeaders.set(key, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response("Bad Gateway: Relay Failed", { status: 502 });
  }
}
