/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 5173 belongs to switchboard admin-ui on this machine; 5180 was freed by apollo-net
  server: { port: 5180 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
