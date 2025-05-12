// proxy-checker-worker.js

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle root path with HTML interface
    if (path === "/" || path === "") {
      return new Response(getHtmlInterface(), {
        headers: { "Content-Type": "text/html" }
      });
    }
    
    // Handle API request
    if (path === "/api/check") {
      const proxyIp = url.searchParams.get('ip');
      const proxyPort = url.searchParams.get('port');
      
      if (!proxyIp || !proxyPort) {
        return new Response(JSON.stringify({ error: "IP and port are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      return await checkProxy(proxyIp, proxyPort);
    }
    
    // Handle batch check
    if (path === "/api/batch") {
      const formData = await request.formData();
      const proxyList = formData.get('proxyList');
      
      if (!proxyList) {
        return new Response(JSON.stringify({ error: "Proxy list is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      return await batchCheckProxies(proxyList);
    }
    
    return new Response("Not found", { status: 404 });
  }
};

async function checkProxy(ip, port) {
  const startTime = Date.now();
  const resolverUrl = "https://speed.cloudflare.com/meta";
  
  try {
    // First, get our original IP without proxy
    const originalResponse = await fetch(resolverUrl);
    const originalData = await originalResponse.json();
    const originalIp = originalData.clientIp;
    
    // Now try to use the proxy
    // Note: This is a best-effort approach since Workers don't support direct proxy configuration
    let proxyResponse;
    let proxyData;
    let proxyWorking = false;
    
    try {
      // Try to make a request that might go through the proxy
      // This is a workaround and may not work for all proxy types
      const proxyUrl = `http://${ip}:${port}`;
      
      // Attempt 1: Try direct connection to the proxy with special headers
      proxyResponse = await fetch(proxyUrl, {
        method: "GET",
        headers: {
          "Host": "speed.cloudflare.com",
          "Path": "/meta",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10240"
        },
        cf: { timeout: 5000 }
      });
      
      // Try to parse the response
      const text = await proxyResponse.text();
      try {
        proxyData = JSON.parse(text);
        // If we got a valid response with a different IP, the proxy is working
        if (proxyData && proxyData.clientIp && proxyData.clientIp !== originalIp) {
          proxyWorking = true;
        }
      } catch (e) {
        // Not JSON, try another approach
      }
    } catch (proxyError) {
      // First attempt failed, try another approach
      try {
        // Attempt 2: Try HTTPS
        const proxyHttpsUrl = `https://${ip}:${port}`;
        proxyResponse = await fetch(proxyHttpsUrl, {
          method: "GET",
          headers: {
            "Host": "speed.cloudflare.com",
            "Path": "/meta"
          },
          cf: { timeout: 5000 }
        });
        
        const text = await proxyResponse.text();
        try {
          proxyData = JSON.parse(text);
          if (proxyData && proxyData.clientIp && proxyData.clientIp !== originalIp) {
            proxyWorking = true;
          }
        } catch (e) {
          // Not JSON
        }
      } catch (httpsError) {
        // Both attempts failed
        proxyWorking = false;
      }
    }
    
    // If we couldn't get proxy data, use the original data for info
    const dataToUse = proxyData || originalData;
    
    const endTime = Date.now();
    const delay = endTime - startTime;
    
    // Clean organization name
    const orgName = dataToUse.asOrganization ? 
      dataToUse.asOrganization.replace(/[^a-zA-Z0-9\s]/g, '') : 
      "N/A";
    
    // Create result object
    const result = {
      status: proxyWorking ? "ACTIVE" : "INACTIVE",
      ip: ip,
      port: port,
      originalIp: originalIp,
      proxyIp: proxyData?.clientIp || "N/A",
      colo: dataToUse.colo || "N/A",
      organization: orgName,
      asn: dataToUse.asn || "N/A",
      country: dataToUse.country || "N/A",
      city: dataToUse.city || "N/A",
      longitude: dataToUse.longitude || "N/A",
      latitude: dataToUse.latitude || "N/A",
      timezone: dataToUse.timezone || "N/A",
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
      ip: ip,
      port: port,
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

async function batchCheckProxies(proxyList) {
  const lines = proxyList.split('\n');
  const results = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    try {
      const [ip, port] = trimmed.split(',');
      if (!ip || !port) continue;
      
      const response = await checkProxy(ip, port);
      const result = await response.json();
      results.push(result);
    } catch (error) {
      results.push({
        status: "FAILED TO CHECK",
        proxy: trimmed,
        error: error.message
      });
    }
  }
  
  return new Response(JSON.stringify(results, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

function getHtmlInterface() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proxy Checker</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      .container {
        background-color: #f5f5f5;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      h1 {
        color: #333;
        text-align: center;
      }
      .form-group {
        margin-bottom: 15px;
      }
      label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }
      input[type="text"], textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
      }
      textarea {
        height: 150px;
      }
      button {
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
      }
      button:hover {
        background-color: #45a049;
      }
      .tabs {
        display: flex;
        margin-bottom: 20px;
      }
      .tab {
        padding: 10px 20px;
        cursor: pointer;
        border: 1px solid #ddd;
        background-color: #f1f1f1;
        border-radius: 4px 4px 0 0;
        margin-right: 5px;
      }
      .tab.active {
        background-color: #fff;
        border-bottom: 1px solid #fff;
      }
      .tab-content {
        display: none;
      }
      .tab-content.active {
        display: block;
      }
      #results {
        margin-top: 20px;
        white-space: pre-wrap;
        background-color: #f8f8f8;
        padding: 15px;
        border-radius: 4px;
        border: 1px solid #ddd;
        max-height: 300px;
        overflow-y: auto;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Proxy Checker</h1>
      
      <div class="tabs">
        <div class="tab active" onclick="switchTab('single')">Single Proxy</div>
        <div class="tab" onclick="switchTab('batch')">Batch Check</div>
      </div>
      
      <div id="single-tab" class="tab-content active">
        <div class="form-group">
          <label for="ip">IP Address:</label>
          <input type="text" id="ip" placeholder="Enter IP address">
        </div>
        
        <div class="form-group">
          <label for="port">Port:</label>
          <input type="text" id="port" placeholder="Enter port">
        </div>
        
        <button onclick="checkSingleProxy()">Check Proxy</button>
      </div>
      
      <div id="batch-tab" class="tab-content">
        <div class="form-group">
          <label for="proxy-list">Proxy List (IP,Port format, one per line):</label>
          <textarea id="proxy-list" placeholder="Enter proxies in format: IP,Port"></textarea>
        </div>
        
        <button onclick="checkBatchProxies()">Check Proxies</button>
      </div>
      
      <div id="results"></div>
    </div>
    
    <script>
      function switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
          tab.classList.remove('active');
        });
        
        document.querySelectorAll('.tab').forEach(tab => {
          tab.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(tabName + '-tab').classList.add('active');
        document.querySelector('.tab:nth-child(' + (tabName === 'single' ? '1' : '2') + ')').classList.add('active');
      }
      
      async function checkSingleProxy() {
        const ip = document.getElementById('ip').value.trim();
        const port = document.getElementById('port').value.trim();
        const resultsDiv = document.getElementById('results');
        
        if (!ip || !port) {
          resultsDiv.textContent = "Please enter both IP and port";
          return;
        }
        
        resultsDiv.textContent = "Checking proxy...";
        
        try {
          const response = await fetch(\`/api/check?ip=\${ip}&port=\${port}\`);
          const data = await response.json();
          resultsDiv.textContent = JSON.stringify(data, null, 2);
        } catch (error) {
          resultsDiv.textContent = "Error: " + error.message;
        }
      }
      
      async function checkBatchProxies() {
        const proxyList = document.getElementById('proxy-list').value.trim();
        const resultsDiv = document.getElementById('results');
        
        if (!proxyList) {
          resultsDiv.textContent = "Please enter at least one proxy";
          return;
        }
        
        resultsDiv.textContent = "Checking proxies...";
        
        try {
          const formData = new FormData();
          formData.append('proxyList', proxyList);
          
          const response = await fetch('/api/batch', {
            method: 'POST',
            body: formData
          });
          
          const data = await response.json();
          resultsDiv.textContent = JSON.stringify(data, null, 2);
        } catch (error) {
          resultsDiv.textContent = "Error: " + error.message;
        }
      }
    </script>
  </body>
  </html>
  `;
}
