import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen"
      style={{ background: 'var(--neutral-50)' }}
    >
      <h1
        className="text-6xl font-bold mb-4"
        style={{ color: 'var(--ufly-navy)', fontFamily: 'var(--font-display)' }}
      >
        404
      </h1>
      <p className="mb-8" style={{ color: 'var(--neutral-500)' }}>
        Página não encontrada
      </p>
      <Link
        to="/dashboard"
        className="px-6 py-2 font-medium transition-opacity hover:opacity-90"
        style={{
          background: 'var(--ufly-navy)',
          color: '#fff',
          borderRadius: 'var(--radius-md)',
        }}
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
