import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
   base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor: React core (shared by everything)
          'vendor-react': ['react', 'react-dom'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // React Query
          'vendor-query': ['@tanstack/react-query'],
          // Date utilities
          'vendor-date': ['date-fns', 'date-fns-tz'],
          // UI primitives (Radix)
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-avatar',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-alert-dialog',
          ],
          // Icons
          'vendor-icons': ['lucide-react', '@phosphor-icons/react'],
          // PDF generation (only loaded when needed)
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          // Table
          'vendor-table': ['@tanstack/react-table'],
        },
      },
    },
  },
})
