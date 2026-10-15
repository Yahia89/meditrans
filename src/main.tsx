import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/error-boundary'
import { getErrorDiagnostic } from './lib/error-diagnostics'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!, {
  onCaughtError(error, info) {
    // Our boundary reports a sanitized diagnostic in componentDidCatch. React's
    // default handler would additionally log the raw error and any private text.
    if (info.errorBoundary instanceof ErrorBoundary) return;
    const diagnostic = getErrorDiagnostic(error, info.componentStack);
    console.error('React UI diagnostic', import.meta.env.DEV ? diagnostic : { reference: diagnostic.reference, kind: diagnostic.kind });
  },
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
