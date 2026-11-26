'use client';

import Link from 'next/link';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FAF9F6',
          color: '#181715',
          fontFamily:
            'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        }}
      >
        <header
          style={{
            borderBottom: '1px solid #EAE6DF',
            backgroundColor: '#FFFFFF',
            padding: '16px 24px',
          }}
        >
          <div style={{ maxWidth: '1152px', margin: '0 auto', fontWeight: 600, fontSize: '14px' }}>
            SEBAKUL
          </div>
        </header>

        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #EAE6DF',
              borderRadius: '12px',
              padding: '32px 24px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#716C65',
              }}
            >
              500 Internal Server Error
            </p>
            <h1 style={{ margin: '8px 0 10px', fontSize: '22px', fontWeight: 600 }}>
              Gangguan pemrosesan layanan
            </h1>
            <p style={{ margin: '0 0 24px', fontSize: '14px', lineHeight: 1.6, color: '#57534E' }}>
              Permintaan belum dapat diselesaikan karena kendala sementara pada server. Silakan
              coba muat ulang atau kembali ke halaman utama.
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  minHeight: '44px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#0F766E',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Coba lagi
              </button>
              <Link
                href="/"
                style={{
                  minHeight: '44px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  border: '1px solid #EAE6DF',
                  backgroundColor: '#FFFFFF',
                  color: '#181715',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Kembali ke beranda
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
