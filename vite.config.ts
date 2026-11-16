import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import legacy from '@vitejs/plugin-legacy';

function customLlmProxyMiddleware(req: IncomingMessage, res: ServerResponse) {
  const targetUrl = req.headers['x-llm-target-url'];
  const target = Array.isArray(targetUrl) ? targetUrl[0] : targetUrl;

  if (!target || !/^https?:\/\//i.test(target)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { message: 'Missing or invalid X-LLM-Target-URL header' } }));
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const forwardHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        const lower = k.toLowerCase();
        if (
          [
            'host',
            'origin',
            'referer',
            'connection',
            'content-length',
            'x-llm-target-url',
            'sec-fetch-mode',
            'sec-fetch-site',
            'sec-fetch-dest',
          ].includes(lower)
        ) {
          continue;
        }
        if (typeof v === 'string') forwardHeaders[k] = v;
        else if (Array.isArray(v) && v.length > 0) forwardHeaders[k] = v.join(', ');
      }

      const bodyBuf = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
      const method = req.method || 'GET';
      const upstream = await fetch(target, {
        method,
        headers: forwardHeaders,
        body: method !== 'GET' && method !== 'HEAD' ? bodyBuf : undefined,
      });

      const respText = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      );
      res.end(respText);
    } catch (err) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: {
            message: `Verbindung zum Custom-Endpunkt fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
          },
        }),
      );
    }
  });
}


// @novnc/novnc nutzt ein Top-level await. Das laesst sich nicht nach ES5
// uebersetzen und wuerde die App auf aelteren Android-WebViews blockieren.
// Der WebCodecs-Test wird deshalb verzoegert ausgefuehrt.
function novncNoTopLevelAwait() {
  const needle = 'supportsWebCodecsH264Decode = await _checkWebCodecsH264DecodeSupport();';
  const replacement =
    'void _checkWebCodecsH264DecodeSupport().then((v) => { supportsWebCodecsH264Decode = v; }).catch(() => {});';
  return {
    name: 'novnc-no-top-level-await',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('@novnc/novnc') || !code.includes(needle)) return null;
      return { code: code.replace(needle, replacement), map: null };
    },
  };
}

export default defineConfig({
  plugins: [
    novncNoTopLevelAwait(),
    react(),
    tailwindcss(),
    // Alte Android-WebViews (z. B. Android 7) verstehen keine ES-Module:
    // plugin-legacy liefert zusaetzlich einen ES5-Build mit Polyfills.
    legacy({
      targets: ['chrome >= 51', 'android >= 7'],
      modernPolyfills: true,
    }),
    {
      name: 'custom-openai-compatible-proxy',
      configureServer(server) {
        server.middlewares.use('/proxy/llm', customLlmProxyMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use('/proxy/llm', customLlmProxyMiddleware);
      },
    },
  ],
  esbuild: {
    target: 'es2015',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/proxy/instabox': {
        target: 'https://api.instabox.sh',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/instabox/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
      '/proxy/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/openai/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    proxy: {
      '/proxy/instabox': {
        target: 'https://api.instabox.sh',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/instabox/, ''),
      },
      '/proxy/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/openai/, ''),
      },
    },
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    sourcemap: false,
  },
});
