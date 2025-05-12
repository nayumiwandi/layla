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
    
    // Handle API request for single proxy check
    if (path === "/api/check") {
      const proxyIp = url.searchParams.get('ip');
      const proxyPort = url.searchParams.get('port');
      
      if (!proxyIp || !proxyPort) {
        return new Response(JSON.stringify({ 
          error: "IP and port are required",
          example: "/api/check?ip=36.95.152.58&port=12137" 
        }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      
      return await checkProxy(proxyIp, proxyPort);
    }
    
    // Handle batch check
    if (path === "/api/batch") {
      try {
        const contentType = request.headers.get("content-type") || "";
        
        let proxyList;
        if (contentType.includes("application/json")) {
          const body = await request.json();
          proxyList = body.proxies;
        } else if (contentType.includes("application/x-www-form-urlencoded") || 
                  contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          proxyList = formData.get('proxies');
        } else {
          // Assume text/plain or other format
          proxyList = await request.text();
        }
        
        if (!proxyList) {
          return new Response(JSON.stringify({ 
            error: "Proxy list is required",
            example: "POST with body: { \"proxies\": [\"36.95.152.58:12137\", \"1.2.3.4:8080\"] }" 
          }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
        
        return await batchCheckProxies(proxyList);
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: "Invalid request format",
          message: error.message
        }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }
    
    // Handle API documentation
    if (path === "/api" || path === "/api/docs") {
      return new Response(getApiDocs(), {
        headers: { "Content-Type": "text/html" }
      });
    }
    
    // Handle OPTIONS for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    
    return new Response("Not found", { 
      status: 404,
      headers: { "Content-Type": "text/plain" }
    });
  }
};

async function checkProxy(ip, port) {
  const startTime = Date.now();
  
  try {
    // Use the yumiproxy API to check the proxy
    const apiUrl = `https://yumiproxy.vercel.app/api/v1?ip=${ip}&port=${port}`;
    
    const response = await fetch(apiUrl, {
      cf: { timeout: 10000 } // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    const endTime = Date.now();
    const delay = endTime - startTime;
    
    // Add the delay to the response
    const result = {
      ...data,
      checkDelay: `${delay} ms`
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
      checkDelay: `${delay} ms`
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
  let proxies = [];
  
  // Handle different input formats
  if (typeof proxyList === 'string') {
    // Handle text format (one proxy per line)
    proxies = proxyList.split(/[\n,]/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } else if (Array.isArray(proxyList)) {
    // Handle array format
    proxies = proxyList;
  } else {
    return new Response(JSON.stringify({ 
      error: "Invalid proxy list format" 
    }), {
      status: 400,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  
  const results = [];
  const startTime = Date.now();
  
  // Process each proxy (up to 50 max)
  const maxProxies = Math.min(proxies.length, 50);
  for (let i = 0; i < maxProxies; i++) {
    const proxy = proxies[i];
    let ip, port;
    
    // Parse IP:Port format
    if (proxy.includes(':')) {
      [ip, port] = proxy.split(':');
    } else {
      // Try to parse from comma-separated format
      const parts = proxy.split(',');
      ip = parts[0];
      port = parts[1];
    }
    
    if (!ip || !port) {
      results.push({
        proxy: proxy,
        status: "INVALID FORMAT",
        error: "Could not parse IP and port"
      });
      continue;
    }
    
    try {
      const response = await checkProxy(ip.trim(), port.trim());
      const result = await response.json();
      results.push({
        proxy: `${ip}:${port}`,
        ...result
      });
    } catch (error) {
      results.push({
        proxy: `${ip}:${port}`,
        status: "FAILED TO CHECK",
        error: error.message
      });
    }
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  return new Response(JSON.stringify({
    results: results,
    totalProxies: results.length,
    totalTime: `${totalTime} ms`
  }, null, 2), {
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
    <title>YumiProxy Checker</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
      :root {
        --primary: #4f46e5;
        --primary-dark: #4338ca;
        --secondary: #10b981;
        --secondary-dark: #059669;
        --danger: #ef4444;
        --warning: #f59e0b;
        --dark: #1f2937;
        --light: #f9fafb;
        --gray: #6b7280;
        --gray-light: #e5e7eb;
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        background-color: #f3f4f6;
        color: var(--dark);
        line-height: 1.5;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      
      header {
        background-color: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        padding: 1rem 0;
        margin-bottom: 2rem;
      }
      
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--primary);
      }
      
      .logo i {
        font-size: 1.8rem;
      }
      
      nav ul {
        display: flex;
        list-style: none;
        gap: 1.5rem;
      }
      
      nav a {
        text-decoration: none;
        color: var(--dark);
        font-weight: 500;
        transition: color 0.2s;
      }
      
      nav a:hover {
        color: var(--primary);
      }
      
      .card {
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      }
      
      h1, h2, h3 {
        color: var(--dark);
        margin-bottom: 1rem;
      }
      
      h1 {
        font-size: 1.875rem;
      }
      
      h2 {
        font-size: 1.5rem;
        border-bottom: 1px solid var(--gray-light);
        padding-bottom: 0.5rem;
      }
      
      .tabs {
        display: flex;
        border-bottom: 1px solid var(--gray-light);
        margin-bottom: 1.5rem;
      }
      
      .tab {
        padding: 0.75rem 1.5rem;
        cursor: pointer;
        font-weight: 500;
        color: var(--gray);
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }
      
      .tab:hover {
        color: var(--primary);
      }
      
      .tab.active {
        color: var(--primary);
        border-bottom: 2px solid var(--primary);
      }
      
      .tab-content {
        display: none;
      }
      
      .tab-content.active {
        display: block;
      }
      
      .form-group {
        margin-bottom: 1rem;
      }
      
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
      }
      
      input[type="text"], textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--gray-light);
        border-radius: 0.375rem;
        font-size: 1rem;
        transition: border-color 0.2s;
      }
      
      input[type="text"]:focus, textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }
      
      textarea {
        min-height: 150px;
        resize: vertical;
      }
      
      .btn {
        display: inline-block;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        font-weight: 500;
        text-align: center;
        text-decoration: none;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      
      .btn-primary {
        background-color: var(--primary);
        color: white;
      }
      
      .btn-primary:hover {
        background-color: var(--primary-dark);
      }
      
      .btn-secondary {
        background-color: var(--secondary);
        color: white;
      }
      
      .btn-secondary:hover {
        background-color: var(--secondary-dark);
      }
      
      .btn-outline {
        background-color: transparent;
        border: 1px solid var(--gray-light);
        color: var(--gray);
      }
      
      .btn-outline:hover {
        border-color: var(--primary);
        color: var(--primary);
      }
      
      .btn-sm {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
      }
      
      .input-group {
        display: flex;
      }
      
      .input-group input {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        flex: 1;
      }
      
      .input-group .btn {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
      
      .results-container {
        margin-top: 1.5rem;
      }
      
      .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }
      
      .results-actions {
        display: flex;
        gap: 0.5rem;
      }
      
      #results {
        background-color: #f8fafc;
        border: 1px solid var(--gray-light);
        border-radius: 0.375rem;
        padding: 1rem;
        white-space: pre-wrap;
        font-family: 'Fira Code', 'Courier New', monospace;
        font-size: 0.875rem;
        overflow-x: auto;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .proxy-card {
        border: 1px solid var(--gray-light);
        border-radius: 0.375rem;
        padding: 1rem;
        margin-bottom: 1rem;
        transition: all 0.2s;
      }
      
      .proxy-card:hover {
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      }
      
      .proxy-card.active {
        border-left: 4px solid var(--secondary);
      }
      
      .proxy-card.inactive {
        border-left: 4px solid var(--danger);
      }
      
      .proxy-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      
      .proxy-title {
        font-weight: 600;
        font-size: 1.125rem;
      }
      
      .proxy-status {
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      
      .status-active {
        background-color: rgba(16, 185, 129, 0.1);
        color: var(--secondary);
      }
      
      .status-inactive {
        background-color: rgba(239, 68, 68, 0.1);
        color: var(--danger);
      }
      
      .proxy-details {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem;
        margin-top: 0.75rem;
      }
      
      .detail-item {
        display: flex;
        flex-direction: column;
      }
      
      .detail-label {
        font-size: 0.75rem;
        color: var(--gray);
        margin-bottom: 0.25rem;
      }
      
      .detail-value {
        font-weight: 500;
      }
      
      .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 2rem;
      }
      
      .spinner {
        border: 3px solid rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        border-top: 3px solid var(--primary);
        width: 24px;
        height: 24px;
        animation: spin 1s linear infinite;
        margin-right: 0.75rem;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .footer {
        text-align: center;
        padding: 2rem 0;
        color: var(--gray);
        font-size: 0.875rem;
      }
      
      .footer a {
        color: var(--primary);
        text-decoration: none;
      }
      
      .api-info {
        background-color: #f8fafc;
        border-radius: 0.375rem;
        padding: 1rem;
        margin-top: 1rem;
      }
      
      .api-url {
        font-family: 'Fira Code', 'Courier New', monospace;
        background-color: #e5e7eb;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
      }
      
      .copy-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--primary);
        margin-left: 0.5rem;
      }
      
      /* Responsive */
      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          gap: 1rem;
        }
        
        nav ul {
          gap: 1rem;
        }
        
        .proxy-details {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="container header-content">
        <div class="logo">
          <i class="fas fa-network-wired"></i>
          <span>YumiProxy Checker</span>
        </div>
        <nav>
          <ul>
            <li><a href="#" class="active">Home</a></li>
            <li><a href="/api/docs">API Docs</a></li>
            <li><a href="https://github.com/yourusername/proxy-checker" target="_blank">GitHub</a></li>
          </ul>
        </nav>
      </div>
    </header>
    
    <main class="container">
      <div class="card">
        <h1>Proxy Checker</h1>
        <p>Check if your proxy is working and get detailed information about it.</p>
        
        <div class="tabs">
          <div class="tab active" onclick="switchTab('single')">Single Proxy</div>
          <div class="tab" onclick="switchTab('batch')">Batch Check</div>
        </div>
        
        <div id="single-tab" class="tab-content active">
          <div class="form-group">
            <label for="ip">IP Address:</label>
            <input type="text" id="ip" placeholder="Enter IP address" value="36.95.152.58">
          </div>
          
          <div class="form-group">
            <label for="port">Port:</label>
            <input type="text" id="port" placeholder="Enter port" value="12137">
          </div>
          
          <button class="btn btn-primary" onclick="checkSingleProxy()">
            <i class="fas fa-search"></i> Check Proxy
          </button>
        </div>
        
        <div id="batch-tab" class="tab-content">
          <div class="form-group">
            <label for="proxy-list">Proxy List (IP:Port format, one per line):</label>
            <textarea id="proxy-list" placeholder="Enter proxies in format: IP:Port or IP,Port">36.95.152.58:12137
1.2.3.4:8080</textarea>
          </div>
          
          <button class="btn btn-primary" onclick="checkBatchProxies()">
            <i class="fas fa-search"></i> Check Proxies
          </button>
        </div>
      </div>
      
      <div class="card results-container" id="results-container" style="display: none;">
        <div class="results-header">
          <h2>Results</h2>
          <div class="results-actions">
            <button class="btn btn-outline btn-sm" onclick="copyResults()">
              <i class="far fa-copy"></i> Copy
            </button>
            <button class="btn btn-outline btn-sm" onclick="downloadResults()">
              <i class="fas fa-download"></i> Download
            </button>
          </div>
        </div>
        
        <div id="results-content"></div>
      </div>
      
      <div class="card">
        <h2>API Information</h2>
        <p>You can also use our API to check proxies programmatically.</p>
        
        <div class="api-info">
          <p>Single Proxy Check:</p>
          <code class="api-url">GET /api/check?ip=36.95.152.58&port=12137</code>
          <button class="copy-btn" onclick="copyToClipboard('/api/check?ip=36.95.152.58&port=12137')">
            <i class="far fa-copy"></i>
          </button>
        </div>
        
        <div class="api-info">
          <p>Batch Check:</p>
          <code class="api-url">POST /api/batch</code>
          <button class="copy-btn" onclick="copyToClipboard('/api/batch')">
            <i class="far fa-copy"></i>
          </button>
          <p style="margin-top: 0.5rem;">Request body: JSON array or text with one proxy per line</p>
        </div>
        
        <p style="margin-top: 1rem;">
          <a href="/api/docs" class="btn btn-outline">
            <i class="fas fa-book"></i> View Full API Documentation
          </a>
        </p>
      </div>
    </main>
    
    <footer class="footer">
      <div class="container">
        <p>© 2023 YumiProxy Checker. All rights reserved.</p>
        <p>Powered by <a href="https://workers.cloudflare.com/" target="_blank">Cloudflare Workers</a></p>
      </div>
    </footer>
    
    <script>
      // Switch between tabs
      function switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => {
          tab.classList.remove('active');
        });
        
        document.querySelectorAll('.tab').forEach(tab => {
          tab.classList.remove('active');
        });
        
        document.getElementById(tabName + '-tab').classList.add('active');
        document.querySelector('.tab:nth-child(' + (tabName === 'single' ? '1' : '2') + ')').classList.add('active');
      }
      
      // Check a single proxy
      async function checkSingleProxy() {
        const ip = document.getElementById('ip').value.trim();
        const port = document.getElementById('port').value.trim();
        
        if (!ip || !port) {
          alert("Please enter both IP and port");
          return;
        }
        
        showLoading();
        
        try {
          const response = await fetch(\`/api/check?ip=\${ip}&port=\${port}\`);
          const data = await response.json();
          
          displayResults([data]);
        } catch (error) {
          showError(error.message);
        }
      }
      
      // Check multiple proxies
      async function checkBatchProxies() {
        const proxyList = document.getElementById('proxy-list').value.trim();
        
        if (!proxyList) {
          alert("Please enter at least one proxy");
          return;
        }
        
        showLoading();
        
        try {
          const response = await fetch('/api/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ proxies: proxyList.split('\\n') })
          });
          
          const data = await response.json();
          displayResults(data.results);
        } catch (error) {
          showError(error.message);
        }
      }
      
      // Show loading indicator
      function showLoading() {
        const resultsContainer = document.getElementById('results-container');
        resultsContainer.style.display = 'block';
        
        document.getElementById('results-content').innerHTML = \`
          <div class="loading">
            <div class="spinner"></div>
            <span>Checking proxies...</span>
          </div>
        \`;
      }
      
      // Show error message
      function showError(message) {
        const resultsContainer = document.getElementById('results-container');
        resultsContainer.style.display = 'block';
        
        document.getElementById('results-content').innerHTML = \`
          <div style="color: var(--danger); padding: 1rem;">
            <i class="fas fa-exclamation-circle"></i> Error: \${message}
          </div>
        \`;
      }
      
      // Display results in a nice format
      function displayResults(results) {
        const resultsContainer = document.getElementById('results-container');
        resultsContainer.style.display = 'block';
        
        const resultsContent = document.getElementById('results-content');
        resultsContent.innerHTML = '';
        
        if (!results || results.length === 0) {
          resultsContent.innerHTML = '<p>No results found.</p>';
          return;
        }
        
        // Store results for copy/download
        window.lastResults = results;
        
        results.forEach(result => {
          const isActive = result.status === 'ACTIVE';
          const statusClass = isActive ? 'active' : 'inactive';
          const statusText = isActive ? 'ACTIVE' : 'INACTIVE';
          const statusBadgeClass = isActive ? 'status-active' : 'status-inactive';
          
          const proxyCard = document.createElement('div');
          proxyCard.className = \`proxy-card \${statusClass}\`;
          
          let detailsHtml = '';
          
          // Add all available details
          const details = [
            { label: 'Country', value: result.country || 'N/A' },
            { label: 'City', value: result.city || 'N/A' },
            { label: 'ASN', value: result.asn || 'N/A' },
            { label: 'Organization', value: result.organization || result.asOrganization || 'N/A' },
            { label: 'Timezone', value: result.timezone || 'N/A' },
            { label: 'Longitude', value: result.longitude || 'N/A' },
            { label: 'Latitude', value: result.latitude || 'N/A' },
            { label: 'Check Delay', value: result.checkDelay || 'N/A' }
          ];
          
          details.forEach(detail => {
            detailsHtml += \`
              <div class="detail-item">
                <span class="detail-label">\${detail.label}</span>
                <span class="detail-value">\${detail.value}</span>
              </div>
            \`;
          });
          
          proxyCard.innerHTML = \`
            <div class="proxy-header">
              <div class="proxy-title">\${result.ip || ''}:\${result.port || ''}</div>
              <div class="proxy-status \${statusBadgeClass}">\${statusText}</div>
            </div>
            <div class="proxy-details">
              \${detailsHtml}
            </div>
          \`;
          
          resultsContent.appendChild(proxyCard);
        });
      }
      
      // Copy results to clipboard
      function copyResults() {
        if (!window.lastResults) return;
        
        const text = JSON.stringify(window.lastResults, null, 2);
        navigator.clipboard.writeText(text).then(() => {
          alert('Results copied to clipboard!');
        }).catch(err => {
          console.error('Failed to copy: ', err);
        });
      }
      
      // Download results as JSON file
      function downloadResults() {
        if (!window.lastResults) return;
        
        const text = JSON.stringify(window.lastResults, null, 2);
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'proxy-results.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      // Copy text to clipboard
      function copyToClipboard(text) {
        const fullUrl = window.location.origin + text;
        navigator.clipboard.writeText(fullUrl).then(() => {
          alert('URL copied to clipboard!');
        }).catch(err => {
          console.error('Failed to copy: ', err);
        });
      }
    </script>
  </body>
  </html>
  `;
}

function getApiDocs() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YumiProxy Checker API Documentation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
      :root {
        --primary: #4f46e5;
        --primary-dark: #4338ca;
        --secondary: #10b981;
        --secondary-dark: #059669;
        --danger: #ef4444;
        --warning: #f59e0b;
        --dark: #1f2937;
        --light: #f9fafb;
        --gray: #6b7280;
        --gray-light: #e5e7eb;
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        background-color: #f3f4f6;
        color: var(--dark);
        line-height: 1.5;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      
      header {
        background-color: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        padding: 1rem 0;
        margin-bottom: 2rem;
      }
      
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--primary);
      }
      
      .logo i {
        font-size: 1.8rem;
      }
      
      nav ul {
        display: flex;
        list-style: none;
        gap: 1.5rem;
      }
      
      nav a {
        text-decoration: none;
        color: var(--dark);
        font-weight: 500;
        transition: color 0.2s;
      }
      
      nav a:hover {
        color: var(--primary);
      }
      
      .card {
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      }
      
      h1, h2, h3, h4 {
        color: var(--dark);
        margin-bottom: 1rem;
      }
      
      h1 {
        font-size: 1.875rem;
      }
      
      h2 {
        font-size: 1.5rem;
        border-bottom: 1px solid var(--gray-light);
        padding-bottom: 0.5rem;
        margin-top: 2rem;
      }
      
      h3 {
        font-size: 1.25rem;
        margin-top: 1.5rem;
      }
      
      h4 {
        font-size: 1.125rem;
        margin-top: 1rem;
      }
      
      p {
        margin-bottom: 1rem;
      }
      
      code {
        font-family: 'Fira Code', 'Courier New', monospace;
        background-color: #f1f5f9;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
      }
      
      pre {
        background-color: #f8fafc;
        border: 1px solid var(--gray-light);
        border-radius: 0.375rem;
        padding: 1rem;
        overflow-x: auto;
        margin-bottom: 1.5rem;
      }
      
      pre code {
        background-color: transparent;
        padding: 0;
        font-size: 0.875rem;
      }
      
      .endpoint {
        margin-bottom: 2rem;
        border: 1px solid var(--gray-light);
        border-radius: 0.5rem;
        overflow: hidden;
      }
      
      .endpoint-header {
        display: flex;
        padding: 1rem;
        background-color: #f8fafc;
        border-bottom: 1px solid var(--gray-light);
      }
      
      .http-method {
        font-weight: 600;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        margin-right: 1rem;
        font-size: 0.875rem;
        min-width: 60px;
        text-align: center;
      }
      
      .get {
        background-color: rgba(16, 185, 129, 0.1);
        color: var(--secondary);
      }
      
      .post {
        background-color: rgba(79, 70, 229, 0.1);
        color: var(--primary);
      }
      
      .endpoint-path {
        font-family: 'Fira Code', 'Courier New', monospace;
        font-weight: 500;
      }
      
      .endpoint-body {
        padding: 1rem;
      }
      
      .params-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1.5rem;
      }
      
      .params-table th, .params-table td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid var(--gray-light);
      }
      
      .params-table th {
        font-weight: 600;
        background-color: #f8fafc;
      }
      
      .param-required {
        color: var(--danger);
        font-size: 0.75rem;
        font-weight: 600;
        margin-left: 0.5rem;
      }
      
      .param-optional {
        color: var(--gray);
        font-size: 0.75rem;
        font-weight: 600;
        margin-left: 0.5rem;
      }
      
      .response-example {
        margin-top: 1rem;
      }
      
      .footer {
        text-align: center;
        padding: 2rem 0;
        color: var(--gray);
        font-size: 0.875rem;
      }
      
      .footer a {
        color: var(--primary);
        text-decoration: none;
      }
      
      /* Responsive */
      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          gap: 1rem;
        }
        
        nav ul {
          gap: 1rem;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="container header-content">
        <div class="logo">
          <i class="fas fa-network-wired"></i>
          <span>YumiProxy Checker</span>
        </div>
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/api/docs" class="active">API Docs</a></li>
            <li><a href="https://github.com/yourusername/proxy-checker" target="_blank">GitHub</a></li>
          </ul>
        </nav>
      </div>
    </header>
    
    <main class="container">
      <div class="card">
        <h1>API Documentation</h1>
        <p>
          The YumiProxy Checker API allows you to check proxies programmatically.
          All API endpoints return JSON responses and support CORS for cross-origin requests.
        </p>
        
        <h2>Endpoints</h2>
        
        <div class="endpoint">
          <div class="endpoint-header">
            <div class="http-method get">GET</div>
            <div class="endpoint-path">/api/check</div>
          </div>
          <div class="endpoint-body">
            <p>Check a single proxy and return detailed information about it.</p>
            
            <h4>Query Parameters</h4>
            <table class="params-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ip <span class="param-required">required</span></td>
                  <td>string</td>
                  <td>The IP address of the proxy to check</td>
                </tr>
                <tr>
                  <td>port <span class="param-required">required</span></td>
                  <td>string/integer</td>
                  <td>The port of the proxy to check</td>
                </tr>
              </tbody>
            </table>
            
            <h4>Example Request</h4>
            <pre><code>GET /api/check?ip=36.95.152.58&port=12137</code></pre>
            
            <h4>Example Response</h4>
            <div class="response-example">
              <pre><code>{
  "status": "ACTIVE",
  "ip": "36.95.152.58",
  "port": "12137",
  "country": "ID",
  "asn": 7713,
  "organization": "PT Telekomunikasi Indonesia",
  "colo": "SIN",
  "longitude": "106.82950",
  "latitude": "-6.17500",
  "timezone": "Asia/Jakarta",
  "checkDelay": "523 ms"
}</code></pre>
            </div>
          </div>
        </div>
        
        <div class="endpoint">
          <div class="endpoint-header">
            <div class="http-method post">POST</div>
            <div class="endpoint-path">/api/batch</div>
          </div>
          <div class="endpoint-body">
            <p>Check multiple proxies in a single request.</p>
            
            <h4>Request Body</h4>
            <p>The request body can be in one of the following formats:</p>
            
            <h5>JSON Format</h5>
            <pre><code>{
  "proxies": [
    "36.95.152.58:12137",
    "1.2.3.4:8080"
  ]
}</code></pre>
            
            <h5>Text Format (one proxy per line)</h5>
            <pre><code>36.95.152.58:12137
1.2.3.4:8080</code></pre>
            
            <h5>Form Data</h5>
            <p>You can also send the proxy list as form data with the key "proxies".</p>
            
            <h4>Example Request</h4>
            <pre><code>POST /api/batch
Content-Type: application/json

{
  "proxies": [
    "36.95.152.58:12137",
    "1.2.3.4:8080"
  ]
}</code></pre>
            
            <h4>Example Response</h4>
            <div class="response-example">
              <pre><code>{
  "results": [
    {
      "proxy": "36.95.152.58:12137",
      "status": "ACTIVE",
      "ip": "36.95.152.58",
      "port": "12137",
      "country": "ID",
      "asn": 7713,
      "organization": "PT Telekomunikasi Indonesia",
      "colo": "SIN",
      "longitude": "106.82950",
      "latitude": "-6.17500",
      "timezone": "Asia/Jakarta",
      "checkDelay": "523 ms"
    },
    {
      "proxy": "1.2.3.4:8080",
      "status": "INACTIVE",
      "ip": "1.2.3.4",
      "port": "8080",
      "error": "Connection refused",
      "checkDelay": "312 ms"
    }
  ],
  "totalProxies": 2,
  "totalTime": "835 ms"
}</code></pre>
            </div>
          </div>
        </div>
        
        <h2>Error Handling</h2>
        <p>
          All API endpoints return appropriate HTTP status codes:
        </p>
        <ul style="margin-left: 2rem; margin-bottom: 1rem;">
          <li>200 - OK: The request was successful</li>
          <li>400 - Bad Request: The request was invalid (missing parameters, invalid format)</li>
          <li>500 - Internal Server Error: An error occurred while processing the request</li>
        </ul>
        
        <p>
          Error responses include an "error" field with a description of the error:
        </p>
        <pre><code>{
  "error": "IP and port are required",
  "example": "/api/check?ip=36.95.152.58&port=12137"
}</code></pre>
        
        <h2>Rate Limiting</h2>
        <p>
          To ensure fair usage of the API, the following rate limits apply:
        </p>
        <ul style="margin-left: 2rem; margin-bottom: 1rem;">
          <li>Single proxy check: 60 requests per minute</li>
          <li>Batch check: 10 requests per minute</li>
          <li>Maximum 50 proxies per batch request</li>
        </ul>
      </div>
    </main>
    
    <footer class="footer">
      <div class="container">
        <p>© 2023 YumiProxy Checker. All rights reserved.</p>
        <p>Powered by <a href="https://workers.cloudflare.com/" target="_blank">Cloudflare Workers</a></p>
      </div>
    </footer>
  </body>
  </html>
  `;
}
