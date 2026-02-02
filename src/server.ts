import type { Server } from "bun";

export class AnimationServer {
    private server: Server | null = null;
    private currentHTML: string = "";
    private port = 3000;

    async start(): Promise<number> {
        this.server = Bun.serve({
            port: this.port,
            fetch: (req) => {
                const url = new URL(req.url);

                if (url.pathname === "/") {
                    return new Response(this.getIndexHTML(), {
                        headers: { "Content-Type": "text/html" },
                    });
                }

                if (url.pathname === "/frame") {
                    return new Response(this.currentHTML, {
                        headers: {
                            "Content-Type": "text/html",
                            "Cache-Control":
                                "no-cache, no-store, must-revalidate",
                        },
                    });
                }

                return new Response("Not found", { status: 404 });
            },
        });

        return this.port;
    }

    updateFrame(html: string): void {
        this.currentHTML = html;
    }

    private getIndexHTML(): string {
        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>rush</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #0a0a0a;
      color: #ffffff;
      font-family: 'Courier New', monospace;
      overflow: hidden;
    }
    #container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    #animation {
      border: 2px solid #333;
      box-shadow: 0 0 30px rgba(0, 255, 255, 0.4);
      background: radial-gradient(circle at center, #0a0a0a 0%, #000000 100%);
      will-change: contents;
    }
    #controls {
      margin-top: 20px;
      padding: 15px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 5px;
    }
    button {
      background: #222;
      color: #0ff;
      border: 1px solid #0ff;
      padding: 8px 16px;
      margin: 0 5px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      border-radius: 3px;
      transition: all 0.2s;
    }
    button:hover {
      background: #0ff;
      color: #000;
    }
    .key {
      display: inline-block;
      background: #333;
      padding: 2px 6px;
      border-radius: 3px;
      margin: 0 3px;
      font-weight: bold;
      color: #0ff;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="animation"></div>
    <div id="controls">
      <button onclick="sendCommand('pause')">⏯ Pause/Resume <span class="key">SPACE</span></button>
      <button onclick="sendCommand('slower')">⏪ Slower <span class="key">-</span></button>
      <button onclick="sendCommand('faster')">⏩ Faster <span class="key">+</span></button>
      <button onclick="sendCommand('restart')">🔄 Restart <span class="key">R</span></button>
    </div>
  </div>

  <script>
    let animationFrameId = null;
    let isUpdating = false;
    let lastUpdateTime = 0;
    const targetFrameTime = 1000 / 75; // 75 FPS
    let frameCount = 0;
    let lastFPSTime = performance.now();
    let actualFPS = 0;

    async function updateFrame() {
      if (isUpdating) return;

      isUpdating = true;

      try {
        const response = await fetch('/frame', {
          cache: 'no-store'
        });
        const html = await response.text();
        
        const container = document.getElementById('animation');
        if (container.innerHTML !== html) {
          container.innerHTML = html;
        }
        
        frameCount++;
        const now = performance.now();
        if (now - lastFPSTime >= 1000) {
          actualFPS = Math.round(frameCount / ((now - lastFPSTime) / 1000));
          frameCount = 0;
          lastFPSTime = now;
          console.log(\`Actual FPS: \${actualFPS}\`);
        }
      } catch (err) {
        console.error('Error fetching frame:', err);
      } finally {
        isUpdating = false;
      }
    }

    function sendCommand(cmd) {
      console.log('Command:', cmd);
    }

    function animate(currentTime) {
      if (currentTime - lastUpdateTime >= targetFrameTime) {
        updateFrame();
        lastUpdateTime = currentTime;
      }
      animationFrameId = requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        sendCommand('pause');
      } else if (e.code === 'Equal' || e.code === 'Plus') {
        sendCommand('faster');
      } else if (e.code === 'Minus') {
        sendCommand('slower');
      } else if (e.code === 'KeyR') {
        sendCommand('restart');
      }
    });

    window.addEventListener('beforeunload', () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    });
  </script>
</body>
</html>`;
    }

    stop(): void {
        if (this.server) {
            this.server.stop();
        }
    }
}
