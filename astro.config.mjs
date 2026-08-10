import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://katiasantos.com',
  vite: {
    plugins: [tailwindcss()],
  },
});
