import { RouterProvider } from 'react-router-dom'
import { Suspense } from 'react'
import { router } from './router'

export default function App() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">Loading…</div>}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
