
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    // Updated to match the new Supabase credentials for build-time defaults
    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || 'https://iwnrckpwruufcniqydqt.supabase.co'),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bnJja3B3cnV1ZmNuaXF5ZHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzcsImV4cCI6MjA4NjkyOTk3N30.e5X8eqfphv8PCKcuizOz3ffcBD7yWuGBzALtaUVCngU'),
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        '@supabase/supabase-js',
        'recharts',
        '@google/genai'
      ],
    },
  },
});
