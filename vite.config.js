import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/voice-to-image-generation/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
