'use client'

// Minimal last-resort boundary: replaces the root layout when it crashes,
// so it must render its own <html>/<body> and cannot rely on i18n or CSS.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('Global error:', error)

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#0a0a1a',
          color: '#fafafa',
          textAlign: 'center',
          padding: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
          Something went wrong / Algo salió mal
        </h1>
        <p style={{ maxWidth: '28rem', color: '#a1a1aa', margin: 0 }}>
          An unexpected error occurred. / Ocurrió un error inesperado.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#7c3aed',
            color: '#fff',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Try again / Reintentar
        </button>
      </body>
    </html>
  )
}
