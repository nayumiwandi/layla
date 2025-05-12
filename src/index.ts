export type Env = {}

// HTML template for the main page
const getHtmlTemplate = () => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yumi Proxy Checker</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
    :root {
      --primary-color: #4f46e5;
      --background-light: #ffffff;
      --text-light: #1f2937;
      --background-dark: #1f2937;
      --text-dark: #f3f4f6;
      --muted-light: #f3f4f6;
      --muted-dark: #374151;
    }
    
    .dark {
      --background: var(--background-dark);
      --text: var(--text-dark);
      --muted: var(--muted-dark);
    }
    
    .light {
      --background: var(--background-light);
      --text: var(--text-light);
      --muted: var(--muted-light);
    }
    
    body {
      background-color: var(--background);
      color: var(--text);
      transition: background-color 0.3s, color 0.3s;
    }
    
    .card {
      background-color: var(--background);
      border: 1px solid var(--muted);
    }
    
    .footer {
      background-color: var(--muted);
    }
    
    .profile-photo {
      position: relative;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      overflow: hidden;
      border: 3px solid var(--primary-color);
      animation: pulse 2s infinite;
    }
    
    .profile-photo::before {
      content: '';
      position: absolute;
      top: -3px;
      left: -3px;
      right: -3px;
      bottom: -3px;
      border-radius: 50%;
      border: 2px dashed var(--primary-color);
      animation: spin 8s linear infinite;
    }
    
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(79, 70, 229, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
      }
    }
    
    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
    
    .social-icon {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
    
    .result-card {
      display: none;
    }
    
    .loading {
      display: none;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col light">
  <header class="container mx-auto py-4 px-4 flex justify-between items-center">
    <div class="flex-1">
      <h1 class="text-2xl font-bold">Yumi Proxy Checker</h1>
    </div>
    
    <div class="flex-1 flex justify-center">
      <div class="profile-photo">
        <img src="https://via.placeholder.com/100" alt="Profile" class="w-full h-full object-cover">
      </div>
    </div>
    
    <div class="flex-1 flex justify-end">
      <button id="theme-toggle" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
        <svg id="moon-icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
        </svg>
        <svg id="sun-icon" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
        </svg>
      </button>
    </div>
  </header>

  <main class="container mx-auto flex-1 px-4 py-8">
    <div class="max-w-xl mx-auto card rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold text-center mb-6">Check Proxy Status</h2>
      
      <form id="proxy-form" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input 
            type="text" 
            id="ip-input" 
            placeholder="IP Address" 
            class="md:col-span-2 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          >
          <input 
            type="text" 
            id="port-input" 
            placeholder="Port" 
            class="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          >
        </div>
        <button 
          type="submit" 
          class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Check Proxy
        </button>
      </form>
      
      <div id="loading" class="loading mt-6 text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
        <p class="mt-2">Checking proxy status...</p>
      </div>
      
      <div id="result-card" class="result-card mt-6 border rounded-lg p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 id="result-ip-port" class="text-lg font-semibold"></h3>
          <div class="flex items-center gap-2">
            <span id="result-status" class="text-sm px-2 py-1 rounded-full"></span>
            <span id="result-flag"></span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-500">Country:</span>
              <span id="result-country"></span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Organization:</span>
              <span id="result-org"></span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">ASN:</span>
              <span id="result-asn"></span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Colo:</span>
              <span id="result-colo"></span>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-500">Protocol:</span>
              <span id="result-protocol"></span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Delay:</span>
              <span id="result-delay"></span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Location:</span>
              <span id="result-location"></span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Status:</span>
              <span id="result-message" class="text-green-600"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <footer class="footer py-6 mt-8">
    <div class="container mx-auto px-4">
      <div class="flex flex-col md:flex-row justify-between items-center">
        <div class="mb-4 md:mb-0">
          <p class="text-sm text-gray-500">
            © ${new Date().getFullYear()} Yumi Proxy Checker. All rights reserved.
          </p>
        </div>
        <div class="flex space-x-4">
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-indigo-600 transition-colors">
            <svg class="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
          <a href="https://telegram.org" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-indigo-600 transition-colors">
            <svg class="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0c-6.626 0-12 5.372-12 12 0 6.627 5.374 12 12 12 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12zm3.224 17.871c.188.133.43.166.646.085.215-.082.374-.253.413-.484.1-.585.185-1.124.25-1.555.128-.852.261-1.74.379-2.621.118-.881.212-1.751.298-2.609.028-.28-.031-.458-.195-.6-.164-.142-.381-.156-.566-.064-.327.159-.612.352-.886.556-.89.683-1.815 1.392-2.772 2.123l-.317.253c-.524.422-1.064.858-1.602 1.298-.26.212-.361.469-.313.815.048.346.226.55.508.619l1.843.456c.566.14 1.134.28 1.699.427.284.073.571.142.86.207.378.085.768.173 1.155.265z"/>
            </svg>
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-indigo-600 transition-colors">
            <svg class="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
          <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-indigo-600 transition-colors">
            <svg class="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  </footer>

  <script>
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');
    const body = document.body;
    
    // Check for saved theme preference or use system preference
    const getThemePreference = () => {
      if (localStorage.getItem('theme')) {
        return localStorage.getItem('theme');
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };
    
    // Apply the current theme
    const applyTheme = (theme) => {
      if (theme === 'dark') {
        body.classList.remove('light');
        body.classList.add('dark');
        moonIcon.classList.add('hidden');
        sunIcon.classList.remove('hidden');
      } else {
        body.classList.remove('dark');
        body.classList.add('light');
        moonIcon.classList.remove('hidden');
        sunIcon.classList.add('hidden');
      }
      localStorage.setItem('theme', theme);
    };
    
    // Initialize theme
    applyTheme(getThemePreference());
    
    // Toggle theme when button is clicked
    themeToggle.addEventListener('click', () => {
      const currentTheme = body.classList.contains('dark') ? 'dark' : 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
    });
    
    // Proxy check form submission
    const proxyForm = document.getElementById('proxy-form');
    const ipInput = document.getElementById('ip-input');
    const portInput = document.getElementById('port-input');
    const loadingElement = document.getElementById('loading');
    const resultCard = document.getElementById('result-card');
    
    // Result elements
    const resultIpPort = document.getElementById('result-ip-port');
    const resultStatus = document.getElementById('result-status');
    const resultFlag = document.getElementById('result-flag');
    const resultCountry = document.getElementById('result-country');
    const resultOrg = document.getElementById('result-org');
    const resultAsn = document.getElementById('result-asn');
    const resultColo = document.getElementById('result-colo');
    const resultProtocol = document.getElementById('result-protocol');
    const resultDelay = document.getElementById('result-delay');
    const resultLocation = document.getElementById('result-location');
    const resultMessage = document.getElementById('result-message');
    
    proxyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const ip = ipInput.value.trim();
      const port = portInput.value.trim();
      
      if (!ip || !port) {
        alert('Please enter both IP and port');
        return;
      }
      
      // Show loading indicator
      loadingElement.style.display = 'block';
      resultCard.style.display = 'none';
      
      try {
        const response = await fetch(\`/api/check?ip=\${ip}&port=\${port}\`);
        
        if (!response.ok) {
          throw new Error('Failed to check proxy');
        }
        
        const result = await response.json();
        
        // Update result card
        resultIpPort.textContent = \`\${result.ip}:\${result.port}\`;
        
        // Status badge
        if (result.proxyip) {
          resultStatus.textContent = 'Active';
          resultStatus.className = 'text-sm px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        } else {
          resultStatus.textContent = 'Inactive';
          resultStatus.className = 'text-sm px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        }
        
        resultFlag.textContent = result.countryFlag;
        resultCountry.textContent = \`\${result.countryName} (\${result.countryCode})\`;
        resultOrg.textContent = result.asOrganization;
        resultAsn.textContent = result.asn;
        resultColo.textContent = result.colo;
        resultProtocol.textContent = result.httpProtocol;
        resultDelay.textContent = result.delay;
        resultLocation.textContent = \`\${result.latitude}, \${result.longitude}\`;
        resultMessage.textContent = result.message;
        
        // Show result card
        resultCard.style.display = 'block';
      } catch (error) {
        console.error('Error checking proxy:', error);
        alert('Failed to check proxy. Please try again.');
      } finally {
        // Hide loading indicator
        loadingElement.style.display = 'none';
      }
    });
  </script>
</body>
</html>
`

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Handle API requests
    if (url.pathname === "/api/check") {
      const ip = url.searchParams.get("ip")
      const port = url.searchParams.get("port")

      if (!ip || !port) {
        return new Response(JSON.stringify({ error: "IP and port are required" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        })
      }

      try {
        const response = await fetch(`https://yumiproxy.vercel.app/api/v1?ip=${ip}&port=${port}`)

        if (!response.ok) {
          throw new Error("Failed to fetch proxy data")
        }

        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: {
            "Content-Type": "application/json",
          },
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to check proxy" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        })
      }
    }

    // Serve the main HTML page for all other requests
    return new Response(getHtmlTemplate(), {
      headers: {
        "Content-Type": "text/html",
      },
    })
  },
}
