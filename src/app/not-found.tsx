import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12 text-center focus:outline-none"
    >
      <div className="w-full max-w-md rounded-xl border border-border-subtle bg-surface p-6 shadow-2xs sm:p-8">
        <div className="mx-auto mb-4 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Halaman atau data yang Anda cari mungkin sudah dipindahkan atau tidak tersedia saat ini.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-medium text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 sm:w-auto"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            <span>Kembali ke beranda</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
