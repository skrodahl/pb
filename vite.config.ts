import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true },
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
});
