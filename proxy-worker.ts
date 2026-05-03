import queueHandler from "./src/queue";

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    const originalHost = url.hostname;
    const bridgeHost = "voicemsg.net";

    // We connect to the origin via HTTPS but override the resolution to the specific Ingress IP
    // This uses SSL to the backend
    url.hostname = bridgeHost;
    url.protocol = "https:";

    const proxyRequest = new Request(url.toString(), request);
    proxyRequest.headers.set("Host", bridgeHost);

    try {
      let response = await fetch(proxyRequest, {
        cf: {
          // @ts-ignore
          resolveOverride: "100.65.0.132"
        }
      });

      // Handle potential 301s from origin to stay on voicemsg.net
      if (response.status === 301 || response.status === 302) {
        let location = response.headers.get("Location");
        if (location) {
          location = location.replace(bridgeHost, originalHost);
          const newHeaders = new Headers(response.headers);
          newHeaders.set("Location", location);
          return new Response(response.body, { status: response.status, headers: newHeaders });
        }
      }

      return response;
    } catch (e: any) {
      // Fallback to HTTP if HTTPS fails
      url.protocol = "http:";
      const httpProxy = new Request(url.toString(), request);
      httpProxy.headers.set("Host", bridgeHost);
      httpProxy.headers.set("X-Forwarded-Proto", "https");
      return await fetch(httpProxy);
    }
  },

  async queue(batch: any, env: any) {
    return await queueHandler(batch, env);
  }
}
