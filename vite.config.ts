import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'bitara-development-gallery',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname === '/apresentacoes') {
          res.statusCode = 302;
          res.setHeader('Location', `/apresentacoes/${url.search}`);
          res.end();
          return;
        }
        if (url.pathname === '/apresentacoes/') {
          req.url = `/apresentacoes/index.html${url.search}`;
          return next();
        }
        if (req.url?.split('?')[0].replace(/\/$/, '') !== '/__dev/bitara') return next();
        try {
          const html = await readFile(new URL('./dev/bitara.html', import.meta.url), 'utf8');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(await server.transformIndexHtml('/__dev/bitara', html));
        } catch (error) { next(error as Error); }
      });
    },
  }],
})
