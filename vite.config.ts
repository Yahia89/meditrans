import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"

// https://vite.dev/config/
export default defineConfig({
   base: "/",
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // Merge static workspace/dashboard dependencies to avoid dozens of tiny requests.
  // Dynamic feature imports (charts, dialogs, PDF, maps, XLSX) stay separate.
  // Keep the Vite 7 browser floor while upgrading the build engine.
  build: {
    target: ['chrome107', 'edge107', 'firefox104', 'safari16'],
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'workspace', test: /[/\\]src[/\\]router[/\\]WorkspacePage\.tsx$/, priority: 20 },
            { name: 'dashboard', test: /[/\\]src[/\\]components[/\\]dashboard\.tsx$/, priority: 10 },
          ],
        },
      },
    },
  },
})
