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
        // Keep shared helpers out of optional vendors such as PDF generation.
        // Otherwise a shell dependency can pull the entire PDF chunk at startup.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          // Group package modules, not their entire dependency graphs. In particular,
          // Vite's shared preload helper must not be captured by the PDF vendor.
          if (!id.includes('/node_modules/')) return;
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (id.includes('/node_modules/@supabase/')) return 'vendor-supabase';
          if (/\/node_modules\/@tanstack\/(react-query|query-core)\//.test(id)) return 'vendor-query';
          if (/\/node_modules\/(date-fns|date-fns-tz)\//.test(id)) return 'vendor-date';
          if (id.includes('/node_modules/@radix-ui/')) return 'vendor-radix';
          if (id.includes('/node_modules/lucide-react/') || id.includes('/node_modules/@phosphor-icons/react/')) return 'vendor-icons';
          if (/\/node_modules\/(jspdf|jspdf-autotable)\//.test(id)) return 'vendor-pdf';
          if (/\/node_modules\/@tanstack\/(react-table|table-core)\//.test(id)) return 'vendor-table';
        },
      },
    },
  },
})
