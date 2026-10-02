import { defineConfig } from 'vitest/config';

// Config separada do vite.config.ts para não carregar o plugin da Cloudflare nos testes unitários.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
