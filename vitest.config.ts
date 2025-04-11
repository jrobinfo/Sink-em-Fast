/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // Use jsdom for simulating browser environment for React components
    setupFiles: './vitest.setup.ts', // Optional setup file
    // You might want to exclude certain files/folders
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.*/**', 
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}); 