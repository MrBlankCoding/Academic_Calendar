import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite config with app/ as the project root and dist/ as the build output.
// We treat this as a simple multi-page site: index.html + views/*.html
export default defineConfig({
  root: 'app',
  base: '/',
    build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'app/index.html'),
        login: resolve(__dirname, 'app/views/login.html'),
        register: resolve(__dirname, 'app/views/register.html'),
        dashboard: resolve(__dirname, 'app/views/dashboard.html'),
        calendar: resolve(__dirname, 'app/views/calender.html'),
        notfound: resolve(__dirname, 'app/404.html'),
      },
    },
  },
  server: {
    host: true, // bind to 0.0.0.0
    port: Number(process.env.PORT) || 5173,
    open: '/index.html',
    allowedHosts: ['academic-calendar.onrender.com'],
  },
  preview: {
    host: true, // bind to 0.0.0.0
    port: Number(process.env.PORT) || 5173,
    allowedHosts: ['academic-calendar.onrender.com'],
  },
});
