// proxy-checker-worker.js

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const proxyIp = url.searchParams.get('ip') || "185.169.107.99";
    const proxyPort = url.searchParams.get('port') || "443";
    
    return await checkProxy(proxyIp, proxyPort);
  }
};

async function checkProxy(proxyIp, proxyPort) {
  const startTime = Date.now();
  
  try {
    // First, check if the proxy is responding at all
    // Note: This is a basic check and doesn't verify if it works as a proxy
    const proxyCheckUrl = `http://${proxyIp}:${proxyPort}`;
    let proxyActive = false;
    
    try {
      // Try to connect to the proxy directly
      const proxyResponse = await fetch(proxyCheckUrl, { 
        method: 'HEAD',
        cf: { timeout: 5000 } // 5 second timeout
      });
      proxyActive = proxyResponse.status < 500; // Consider any non-server error as "active"
    } catch (proxyError) {
      // If we can't connect directly, try HTTPS
      try {
        const proxyHttpsUrl = `https://${proxyIp}:${proxyPort}`;
        const proxyHttpsResponse = await fetch(proxyHttpsUrl, { 
          method: 'HEAD',
          cf: { timeout: 5000 }
        });
        proxyActive = proxyHttpsResponse.status < 500;
      } catch (httpsError) {
        proxyActive = false;
      }
    }
    
    // Now get information about the proxy IP from the API
    const infoResponse = await fetch("https://myapicheck.mayumiapi.workers.dev/");
    const proxyInfo = await infoResponse.json();
    
    const endTime = Date.now();
    const delay = endTime - startTime;
    
    // Create result object
    const result = {
      status: proxyActive ? "ACTIVE" : "INACTIVE",
      ip: proxyIp,
      port: proxyPort,
      colo: proxyInfo.colo || "N/A",
      organization: proxyInfo.asOrganization || "N/A",
      asn: proxyInfo.asn || "N/A",
      country: proxyInfo.country || "N/A",
      city: "N/A", // Not provided in the sample response
      longitude: proxyInfo.longitude || "N/A",
      latitude: proxyInfo.latitude || "N/A",
      timezone: proxyInfo.timezone || "N/A",
      tcpRtt: proxyInfo.clientTcpRtt || "N/A",
      totalDelay: `${delay} ms`
    };
    
    // Return formatted response
    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
    
  } catch (error) {
    const endTime = Date.now();
    const delay = endTime - startTime;
    
    // Create error result
    const errorResult = {
      status: "FAILED TO CHECK",
      ip: proxyIp,
      port: proxyPort,
      error: error.message,
      totalDelay: `${delay} ms`
    };
    
    // Return error response
    return new Response(JSON.stringify(errorResult, null, 2), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
