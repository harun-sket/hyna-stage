import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const HTML = `
(function() {
  if (window.__hynaLoaded) return;
  window.__hynaLoaded = true;

  const urlParams = new URLSearchParams(window.location.search);
  const e2bUrl = urlParams.get('url');
  const sandboxId = e2bUrl ? e2bUrl.split('-')[1].split('.')[0] : '';

  const css = \`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;600;700&display=swap');

    #hyna-badge {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      background: rgba(10, 10, 10, 0.8); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      color: #fff; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 50px;
      padding: 10px 20px; font-family: 'Inter', sans-serif;
      font-size: 13px; font-weight: 600; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); transition: all 0.3s ease;
      display: flex; align-items: center; gap: 8px;
    }
    #hyna-badge:hover { border-color: #6366f1; transform: translateY(-2px); }
    #hyna-badge svg { width: 16px; height: 16px; fill: #6366f1; }

    #hyna-panel {
      position: fixed; top: 0; right: -420px; width: 380px; height: 100vh; height: 100dvh; z-index: 100000;
      background-color: #0a0a0a;
      background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px);
      background-size: 20px 20px;
      border-left: 1px solid rgba(255, 255, 255, 0.05); box-shadow: -10px 0 50px rgba(0,0,0,0.8);
      font-family: 'Inter', sans-serif; transition: right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex; flex-direction: column;
    }
    #hyna-panel.open { right: 0; }

    .hyna-header { display: flex; justify-content: space-between; align-items: center; padding: 24px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(10,10,10,0.8); backdrop-filter: blur(10px); }
    .hyna-title { color: #fff; font-size: 18px; font-weight: 700; margin: 0; }
    .hyna-title span { color: #6366f1; }
    .hyna-close { background: none; border: none; color: #666; font-size: 24px; cursor: pointer; transition: color 0.2s; }
    .hyna-close:hover { color: #fff; }

    .hyna-content { padding: 24px; display: flex; flex-direction: column; flex: 1; gap: 20px; }
    
    #hyna-run {
      background: #6366f1; color: #fff; border: none;
      padding: 16px; border-radius: 12px; font-weight: 600; font-size: 15px;
      cursor: pointer; width: 100%; transition: all 0.2s;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
    }
    #hyna-run:hover { background: #4f46e5; box-shadow: 0 0 30px rgba(99, 102, 241, 0.6); }
    #hyna-run:active { transform: scale(0.98); }
    #hyna-run:disabled { background: #333; color: #666; box-shadow: none; cursor: not-allowed; }

    #hyna-out {
      background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
      padding: 20px; font-family: 'IBM Plex Mono', monospace; font-size: 12px;
      color: #d1d5db; flex: 1; overflow-y: auto; white-space: pre-wrap; line-height: 1.7;
    }
    .hyna-pass { color: #10b981; font-weight: 600; }
    .hyna-fail { color: #ef4444; font-weight: 600; }
  \`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const badge = document.createElement('div');
  badge.id = 'hyna-badge';
  badge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.5l7 14H5l7-14z"/></svg> BUILT WITH HYNA-STAGE';
  document.body.appendChild(badge);

  const panel = document.createElement('div');
  panel.id = 'hyna-panel';
  panel.innerHTML = \`
    <div class="hyna-header">
      <h2 class="hyna-title">HYNA<span>VERIFY</span></h2>
      <button class="hyna-close" id="hyna-close">&times;</button>
    </div>
    <div class="hyna-content">
      <button id="hyna-run">Run Test Suite</button>
      <div id="hyna-out">> Ready. Click 'Run Test Suite' to execute.</div>
    </div>
  \`;
  document.body.appendChild(panel);

  badge.onclick = () => panel.classList.toggle('open');
  document.getElementById('hyna-close').onclick = () => panel.classList.remove('open');

  document.getElementById('hyna-run').onclick = async () => {
    const out = document.getElementById('hyna-out');
    const btn = document.getElementById('hyna-run');
    out.innerHTML = '> Connecting to MicroVM...\\n> Executing tests...';
    btn.disabled = true;
    
    try {
      const r = await fetch('/__hyna_run_tests?sandbox=' + sandboxId);
      const text = await r.text();
      out.innerHTML = text.replace(/PASS/g, '<span class="hyna-pass">PASS</span>').replace(/FAIL/g, '<span class="hyna-fail">FAIL</span>');
    } catch(e) {
      out.innerHTML = '<span class="hyna-fail">> Error:</span> ' + e.message;
    } finally {
      btn.disabled = false;
    }
  };
})();
`;

serve(() => new Response(HTML, {
  headers: {
    "Content-Type": "application/javascript",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=60",
  },
}));
