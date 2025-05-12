/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const ip = url.searchParams.get("ip");
    const port = url.searchParams.get("port") || "443";

    if (!ip || !port) {
      return new Response(JSON.stringify({ error: "Parameter 'ip' dan 'port' diperlukan." }), { status: 400 });
    }

    const metaURL = "https://myapicheck.mayumiapi.workers.dev";

    try {
      const oriRes = await fetch(metaURL);
      const oriData = await oriRes.json();
      const oriIp = oriData.clientIp;

      const start = Date.now();
      const proxyRes = await fetch(`${metaURL}api/v1?proxy=${ip}:${port}`);
      const proxyData = await proxyRes.json();
      const proxyIp = proxyData.clientIp;

      if (proxyIp && oriIp !== proxyIp) {
        const delayMs = Date.now() - start;

        return new Response(JSON.stringify({
          status: "active",
          ip,
          port,
          delayMs,
          proxyIp,
          asn: proxyData.asn,
          country: proxyData.country,
          city: proxyData.city,
          regionCode: proxyData.regionCode,
          asOrganization: proxyData.asOrganization,
          tlsVersion: proxyData.tlsVersion,
          timezone: proxyData.timezone,
          latitude: proxyData.latitude,
          longitude: proxyData.longitude,
          colo: proxyData.colo
        }, null, 2), { headers: { "Content-Type": "application/json" } });
      } else {
        return new Response(JSON.stringify({
          status: "dead",
          ip,
          port,
          message: "Proxy tidak menyembunyikan IP asli (tidak aktif)"
        }, null, 2), { headers: { "Content-Type": "application/json" } });
      }

    } catch (err) {
      return new Response(JSON.stringify({
        status: "not active",
        ip,
        port,
        message: "Proxy tidak dapat dihubungi atau gagal mendapatkan data",
        error: err.toString()
      }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  }
};
