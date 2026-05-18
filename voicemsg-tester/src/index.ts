import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TestSuiteRunner } from './tests.js';

const execAsync = promisify(exec);
const app = new Hono();

// Middleware to serve static files/CSS inline, CORS headers
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  await next();
});

// GET / - Beautiful Dark Mode Glassmorphism Diagnostics Console
app.get('/', (c) => {
  const namespace = process.env.NAMESPACE || 'debugging-testcrash-pub';
  const domain = process.env.DOMAIN || 'voicemsg.net';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voice Messenger Integration Testing Console</title>
  <!-- Google Fonts Outfit & JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg-color: #080710;
      --card-bg: rgba(255, 255, 255, 0.05);
      --card-border: rgba(255, 255, 255, 0.1);
      --neon-primary: #7c4dff;
      --neon-secondary: #00e5ff;
      --neon-success: #00e676;
      --neon-danger: #ff1744;
      --neon-warning: #ffea00;
      --text-main: #f5f5f7;
      --text-muted: #8e8e93;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      overflow-x: hidden;
      min-height: 100vh;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(124, 77, 255, 0.15) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(0, 229, 255, 0.12) 0%, transparent 40%);
      background-attachment: fixed;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    /* Header styling */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 20px;
      backdrop-filter: blur(10px);
    }

    .logo-container h1 {
      font-size: 2rem;
      font-weight: 800;
      background: linear-gradient(135deg, #fff 30%, var(--neon-secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .logo-container p {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .badge {
      background: rgba(124, 77, 255, 0.2);
      border: 1px solid rgba(124, 77, 255, 0.4);
      color: #b388ff;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      display: inline-block;
    }

    .controls {
      display: flex;
      gap: 15px;
    }

    /* Beautiful Buttons */
    .btn {
      font-family: 'Outfit', sans-serif;
      padding: 12px 24px;
      border-radius: 30px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--neon-primary) 0%, #651fff 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(124, 77, 255, 0.4);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(124, 77, 255, 0.6);
    }

    .btn-secondary {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text-main);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.2);
    }

    /* Grid of test items */
    .test-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .test-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(12px);
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .test-card:hover {
      transform: translateY(-4px);
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 10px 20px rgba(0,0,0,0.3);
    }

    .test-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: var(--text-muted);
      transition: background-color 0.3s ease;
    }

    .test-card.success::before {
      background: var(--neon-success);
    }

    .test-card.failed::before {
      background: var(--neon-danger);
    }

    .test-card.running::before {
      background: var(--neon-secondary);
    }

    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .test-title {
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: -0.2px;
    }

    .test-target {
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-muted);
      word-break: break-all;
      margin-top: 4px;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: var(--text-muted);
      display: inline-block;
      box-shadow: 0 0 8px rgba(142, 142, 147, 0.5);
    }

    .status-indicator.success {
      background-color: var(--neon-success);
      box-shadow: 0 0 12px var(--neon-success);
    }

    .status-indicator.failed {
      background-color: var(--neon-danger);
      box-shadow: 0 0 12px var(--neon-danger);
    }

    .status-indicator.running {
      background-color: var(--neon-secondary);
      box-shadow: 0 0 12px var(--neon-secondary);
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }

    .test-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.4;
      margin-bottom: 20px;
      min-height: 40px;
    }

    .test-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .latency-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: var(--neon-secondary);
      font-weight: 700;
      background: rgba(0, 229, 255, 0.1);
      padding: 4px 8px;
      border-radius: 6px;
      display: none;
    }

    .test-card.success .latency-badge {
      display: inline-block;
    }

    .btn-card {
      padding: 6px 12px;
      font-size: 0.8rem;
      border-radius: 12px;
    }

    /* Terminal Console logs */
    .terminal-container {
      background: #030206;
      border: 1px solid var(--card-border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 15px 30px rgba(0,0,0,0.5);
    }

    .terminal-header {
      background: rgba(255,255,255,0.03);
      padding: 14px 20px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .terminal-title {
      font-family: 'Outfit', sans-serif;
      font-size: 0.85rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .terminal-dots {
      display: flex;
      gap: 6px;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot-red { background-color: var(--neon-danger); }
    .dot-yellow { background-color: var(--neon-warning); }
    .dot-green { background-color: var(--neon-success); }

    .terminal-body {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      line-height: 1.5;
      padding: 20px;
      height: 380px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* Colored Terminal output */
    .log-line {
      margin-bottom: 6px;
    }

    .log-time {
      color: #636366;
      margin-right: 10px;
    }

    .log-info {
      color: #d1d1d6;
    }

    .log-success {
      color: var(--neon-success);
      font-weight: bold;
    }

    .log-error {
      color: var(--neon-danger);
      font-weight: bold;
    }

    .log-warn {
      color: var(--neon-warning);
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.1);
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  </style>
</head>
<body>

  <div class="container">
    <header>
      <div class="logo-container">
        <h1>Testing & Diagnostics Console</h1>
        <p>Production cluster diagnostics &bull; Namespace: <span style="color:var(--neon-secondary); font-family:'JetBrains Mono'">${namespace}</span></p>
      </div>
      <div class="controls">
        <button class="btn btn-secondary" onclick="runVitest()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          Run Vitest Suite
        </button>
        <button class="btn btn-primary" onclick="runAllTests()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Run All Integration Tests
        </button>
      </div>
    </header>

    <div class="test-grid">
      <!-- Card 1 -->
      <div class="test-card" id="card-mail-worker">
        <div class="test-header">
          <div>
            <div class="test-title">Cloudflare Mail Worker</div>
            <div class="test-target">voicemsg-mail.${domain}</div>
          </div>
          <span class="status-indicator" id="ind-mail-worker"></span>
        </div>
        <div class="test-desc">Verifies live HTTP handshake and sends an unmocked diagnostic verification email via Cloudflare worker.</div>
        <div class="test-footer">
          <span class="latency-badge" id="lat-mail-worker">-- ms</span>
          <button class="btn btn-secondary btn-card" onclick="runSingleTest('mail-worker')">Run Test</button>
        </div>
      </div>

      <!-- Card 2 -->
      <div class="test-card" id="card-whisper-turbo">
        <div class="test-header">
          <div>
            <div class="test-title">Whisper-Turbo ASR</div>
            <div class="test-target">http://whisper-turbo:8000</div>
          </div>
          <span class="status-indicator" id="ind-whisper-turbo"></span>
        </div>
        <div class="test-desc">Tests internal service DNS resolution and runs a real 1-second ASR transcription audio check.</div>
        <div class="test-footer">
          <span class="latency-badge" id="lat-whisper-turbo">-- ms</span>
          <button class="btn btn-secondary btn-card" onclick="runSingleTest('whisper-turbo')">Run Test</button>
        </div>
      </div>

      <!-- Card 3 -->
      <div class="test-card" id="card-redis">
        <div class="test-header">
          <div>
            <div class="test-title">Redis Cache Database</div>
            <div class="test-target">redis://redis:6379</div>
          </div>
          <span class="status-indicator" id="ind-redis"></span>
        </div>
        <div class="test-desc">Asserts socket connection state, evaluates ping latency, and validates TTL read/write operations.</div>
        <div class="test-footer">
          <span class="latency-badge" id="lat-redis">-- ms</span>
          <button class="btn btn-secondary btn-card" onclick="runSingleTest('redis')">Run Test</button>
        </div>
      </div>

      <!-- Card 4 -->
      <div class="test-card" id="card-mongodb">
        <div class="test-header">
          <div>
            <div class="test-title">MongoDB Database</div>
            <div class="test-target">mongodb://mongodb:27017</div>
          </div>
          <span class="status-indicator" id="ind-mongodb"></span>
        </div>
        <div class="test-desc">Validates Mongoose handshake, runs server ping, and queries schemas to assert full CRUD authentication.</div>
        <div class="test-footer">
          <span class="latency-badge" id="lat-mongodb">-- ms</span>
          <button class="btn btn-secondary btn-card" onclick="runSingleTest('mongodb')">Run Test</button>
        </div>
      </div>
    </div>

    <!-- Terminal -->
    <div class="terminal-container">
      <div class="terminal-header">
        <div class="terminal-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          Console Logs & Diagnostics
        </div>
        <div class="terminal-dots">
          <span class="dot dot-green"></span>
          <span class="dot dot-yellow"></span>
          <span class="dot dot-red"></span>
        </div>
      </div>
      <div class="terminal-body" id="console">
<span class="log-line"><span class="log-time">${new Date().toLocaleTimeString()}</span><span class="log-info">Diagnostics server initialized. System ready to run integration suites.</span></span></div>
    </div>
  </div>

  <script>
    const term = document.getElementById('console');

    function appendToConsole(msg, type = 'info') {
      const line = document.createElement('span');
      line.className = 'log-line';
      
      const time = document.createElement('span');
      time.className = 'log-time';
      time.innerText = new Date().toLocaleTimeString() + ' ';
      
      const content = document.createElement('span');
      content.className = 'log-' + type;
      content.innerText = msg;
      
      line.appendChild(time);
      line.appendChild(content);
      term.appendChild(line);
      term.scrollTop = term.scrollHeight;
    }

    function updateCardUI(id, status, latency) {
      const card = document.getElementById('card-' + id);
      const ind = document.getElementById('ind-' + id);
      const lat = document.getElementById('lat-' + id);
      
      card.className = 'test-card ' + status;
      ind.className = 'status-indicator ' + status;
      
      if (status === 'success' && latency) {
        lat.innerText = latency + ' ms';
      }
    }

    async function runSingleTest(testId) {
      appendToConsole('-------------------------------------------');
      appendToConsole('Starting integration check: ' + testId + '...');
      updateCardUI(testId, 'running');
      
      try {
        const res = await fetch('/admin/tester/api/run-test/' + testId, { method: 'POST' });
        const data = await res.json();
        
        // Print inner test logs
        if (data.logs) {
          data.logs.forEach(l => {
            appendToConsole(l.message, l.type);
          });
        }
        
        if (data.status === 'success') {
          appendToConsole('Test "' + data.name + '" passed successfully in ' + data.latency + 'ms.', 'success');
          updateCardUI(testId, 'success', data.latency);
        } else {
          appendToConsole('Test "' + data.name + '" failed.', 'error');
          updateCardUI(testId, 'failed');
        }
      } catch (err) {
        appendToConsole('Failed to reach tester API: ' + err.message, 'error');
        updateCardUI(testId, 'failed');
      }
    }

    async function runAllTests() {
      appendToConsole('===========================================');
      appendToConsole('Running full integration test suite...');
      
      const ids = ['mail-worker', 'whisper-turbo', 'redis', 'mongodb'];
      ids.forEach(id => updateCardUI(id, 'running'));
      
      try {
        const res = await fetch('/admin/tester/api/run-all', { method: 'POST' });
        const results = await res.json();
        
        results.forEach(data => {
          if (data.logs) {
            data.logs.forEach(l => appendToConsole(l.message, l.type));
          }
          if (data.status === 'success') {
            appendToConsole('Test "' + data.name + '" SUCCESS in ' + data.latency + 'ms.', 'success');
            updateCardUI(data.id, 'success', data.latency);
          } else {
            appendToConsole('Test "' + data.name + '" FAILED.', 'error');
            updateCardUI(data.id, 'failed');
          }
        });
      } catch (err) {
        appendToConsole('Failed to run suite: ' + err.message, 'error');
        ids.forEach(id => updateCardUI(id, 'failed'));
      }
    }

    async function runVitest() {
      appendToConsole('===========================================');
      appendToConsole('Triggering programmatic Vitest test suite execution...');
      appendToConsole('npx vitest run ...');
      
      try {
        const res = await fetch('/admin/tester/api/run-vitest', { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
          appendToConsole('Vitest execution complete!', 'success');
          if (data.output) {
            appendToConsole(data.output, 'info');
          }
        } else {
          appendToConsole('Vitest execution returned an error state:', 'error');
          if (data.output) {
            appendToConsole(data.output, 'error');
          }
          if (data.error) {
            appendToConsole(data.error, 'error');
          }
        }
      } catch (err) {
        appendToConsole('Failed to run Vitest: ' + err.message, 'error');
      }
    }
  </script>

</body>
</html>`;
  
  return c.html(html);
});

// POST /api/run-all - Runs all integration tests
app.post('/api/run-all', async (c) => {
  try {
    const runner = new TestSuiteRunner(process.env as any);
    const results = await runner.runAllTests();
    return c.json(results);
  } catch (error: any) {
    return c.json({ error: 'Suite run error', details: error.message || String(error) }, 500);
  }
});

// POST /api/run-test/:id - Runs a single test by its ID
app.post('/api/run-test/:id', async (c) => {
  const testId = c.req.param('id');
  try {
    const runner = new TestSuiteRunner(process.env as any);
    const result = await runner.runTestById(testId);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: `Test ${testId} execution failed`, details: error.message || String(error) }, 500);
  }
});

// POST /api/run-vitest - Programmatically executes vitest run inside the container and returns stdout/stderr
app.post('/api/run-vitest', async (c) => {
  try {
    console.log('[Tester Service] Programmatically executing npx vitest run...');
    // We execute Vitest in the workspace/app context.
    const { stdout, stderr } = await execAsync('npx vitest run', { timeout: 45000 });
    
    return c.json({
      success: true,
      output: stdout || stderr
    });
  } catch (error: any) {
    console.error('[Tester Service] Vitest execution failed:', error);
    return c.json({
      success: false,
      error: error.message || String(error),
      output: error.stdout || error.stderr || ''
    }, 200); // Send 200 so UI can display logs safely
  }
});

// Serve and listen on port 3000
const port = 3000;
console.log(`[Tester Service] Starting server on port ${port}...`);
serve({
  fetch: app.fetch,
  port
});
