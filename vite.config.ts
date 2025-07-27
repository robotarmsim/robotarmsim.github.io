import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/',  // for pages github.io root base is just '/'
  plugins: [
    react(),
    tailwindcss(),
  ],
});

