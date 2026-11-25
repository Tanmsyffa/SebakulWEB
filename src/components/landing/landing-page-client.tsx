'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { buttonVariants } from '@/components/ui/button';
import { FadeIn, PageTransition, useHydratedReducedMotion } from '@/components/motion';

const WARUNG_POINTS = [
  'Buku kas pemasukan dan belanja harian dalam Rupiah bulat berzona waktu WIB.',
  'Opname stok bahan, daftar pemasok, pembelian, serta harga pokok rata-rata tertimbang.',
  'Daftar menu dan resep kebutuhan bahan per porsi untuk membaca estimasi HPP.',
  'Riwayat tagihan sewa lapak, unggah bukti transfer, dan ekspor laporan CSV atau PDF.',
] as const;

const SENTRA_POINTS = [
  'Peta lapak yang memperlihatkan kondisi fisik dan status tagihan secara bersamaan.',
  'Penerbitan tagihan serentak atau per lapak, otomatis membebaskan sewa saat lapak libur.',
  'Pencatatan cicilan, saldo deposit kelebihan bayar, dan verifikasi bukti pembayaran.',
  'Buku kas operasional sentra, pengaturan rekening atau QRIS, serta pengingat WhatsApp.',
] as const;

const ROLES = [
  {
    name: 'Pemilik Warung',
    scope: 'Kas harian, stok bahan, pemasok, menu & resep porsi, serta tagihan sewa lapak sendiri.',
  },
  {
    name: 'Pengelola Sentra',
    scope: 'Peta keterisian lapak, tagihan & verifikasi bayar, buku kas sentra, serta tiket fasilitas.',
  },
  {
    name: 'Super Admin',
    scope: 'Data induk lapak & warung, pendaftaran akun tertutup, transfer pemilik, dan audit log.',
  },
] as const;

export function LandingPageClient({
  isSignedIn = false,
  dashboardHref = '/login',
}: {
  isSignedIn?: boolean;
  dashboardHref?: string;
}) {
  const prefersReduced = useHydratedReducedMotion();
  const primaryHref = isSignedIn ? dashboardHref : '/login';
  const primaryLabel = isSignedIn ? 'Buka dashboard' : 'Masuk';

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-canvas/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <BrandLogo size="sm" priority />
            <span className="text-sm font-semibold tracking-tight text-text-primary">
              SEBAKUL
            </span>
          </Link>

          <nav aria-label="Bagian halaman" className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() => scrollToSection('ruang-kerja')}
              className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Ruang kerja
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('komunitas')}
              className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Guyub & dukungan
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('peran-akses')}
              className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Peran & akses
            </button>
          </nav>

          <Link
            href={primaryHref}
            className={buttonVariants({ variant: 'default', size: 'sm' })}
          >
            <span>{primaryLabel}</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <PageTransition>
          {/* Editorial Hero */}
          <section className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8 lg:pb-20 lg:pt-18">
            <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="space-y-5 lg:col-span-7">
                <p className="text-sm text-text-muted">
                  Sentra Beverages & Kuliner
                </p>
                <h1 className="text-3xl font-semibold leading-[1.15] tracking-tight text-text-primary sm:text-4xl lg:text-[2.75rem]">
                  Buku kerja operasional untuk pengelola sentra dan pemilik warung.
                </h1>
              </div>
              <div className="space-y-5 lg:col-span-5">
                <p className="text-sm leading-relaxed text-text-secondary sm:text-base">
                  Catat arus kas manual, jaga persediaan bahan baku, tertibkan penagihan sewa lapak, dan kelola kegiatan komunitas dalam satu aplikasi tertutup berbasis peran.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={primaryHref}
                    className={buttonVariants({ variant: 'default', size: 'default' })}
                  >
                    <span>{isSignedIn ? 'Buka dashboard' : 'Masuk ke akun'}</span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToSection('ruang-kerja')}
                    className={buttonVariants({ variant: 'secondary', size: 'default' })}
                  >
                    Lihat cara kerja
                  </button>
                </div>
              </div>
            </div>

            <FadeIn delay={0.05} className="mt-8 sm:mt-12">
              <figure className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
                <div className="relative aspect-[16/10] w-full bg-surface-muted sm:aspect-[16/9]">
                  <Image
                    src="/images/landing-hero.jpg"
                    alt="Deretan lapak kayu dan area makan sentra kuliner modern dalam cahaya pagi"
                    fill
                    priority
                    sizes="(max-width: 1152px) 100vw, 1152px"
                    className="object-cover"
                  />
                </div>
                <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-2.5 text-xs text-text-muted sm:px-5">
                  <span>Dirancang untuk layar ponsel pedagang maupun meja kerja pengelola</span>
                  <span className="font-mono">WIB · Rupiah bulat</span>
                </figcaption>
              </figure>
            </FadeIn>
          </section>

          {/* Ruang Kerja: Warung & Sentra */}
          <section
            id="ruang-kerja"
            className="border-t border-border-subtle bg-surface"
          >
            <div className="mx-auto max-w-6xl divide-y divide-border-subtle px-4 sm:px-6 lg:px-8">
              {/* Warung */}
              <FadeIn className="grid grid-cols-1 gap-8 py-12 sm:py-16 lg:grid-cols-12 lg:items-center lg:gap-12">
                <div className="lg:col-span-6">
                  <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-muted">
                    <div className="relative aspect-[4/3] w-full">
                      <Image
                        src="/images/feature-warung.jpg"
                        alt="Bahan baku segar dan gelas saji yang tertata di meja persiapan warung"
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-cover"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4 lg:col-span-6">
                  <p className="font-mono text-xs text-text-muted">01 / Operasional warung</p>
                  <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                    Catatan kas, stok bahan, dan resep yang terpisah tiap warung
                  </h2>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    Setiap pemilik warung bekerja di ruang data miliknya sendiri tanpa tercampur dengan warung lain di sentra yang sama.
                  </p>
                  <ul className="divide-y divide-border-subtle border-t border-border-subtle pt-1 text-sm text-text-primary">
                    {WARUNG_POINTS.map((point) => (
                      <li key={point} className="py-2.5 leading-relaxed">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>

              {/* Sentra */}
              <FadeIn className="grid grid-cols-1 gap-8 py-12 sm:py-16 lg:grid-cols-12 lg:items-center lg:gap-12">
                <div className="order-2 space-y-4 lg:order-1 lg:col-span-6">
                  <p className="font-mono text-xs text-text-muted">02 / Pengelolaan sentra</p>
                  <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                    Peta keterisian lapak dan tagihan sewa yang transparan
                  </h2>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    Pengelola memantau masa kontrak, tagihan berjalan, serta arus kas operasional sentra tanpa rekap manual terpisah.
                  </p>
                  <ul className="divide-y divide-border-subtle border-t border-border-subtle pt-1 text-sm text-text-primary">
                    {SENTRA_POINTS.map((point) => (
                      <li key={point} className="py-2.5 leading-relaxed">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="order-1 lg:order-2 lg:col-span-6">
                  <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-muted">
                    <div className="relative aspect-[4/3] w-full">
                      <Image
                        src="/images/feature-sentra.jpg"
                        alt="Halaman sentra kuliner terbuka dengan kios kayu dan area makan bersih"
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-cover"
                      />
                    </div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </section>

          {/* Komunitas Guyub & Tiket */}
          <section
            id="komunitas"
            className="border-t border-border-subtle bg-canvas"
          >
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-2 md:gap-12 lg:px-8">
              <div className="space-y-2 border-t border-border-strong pt-4">
                <p className="font-mono text-xs text-text-muted">03 / Komunitas</p>
                <h2 className="text-lg font-semibold tracking-tight text-text-primary">
                  SEBAKUL Guyub & penyelesaian patungan
                </h2>
                <p className="text-sm leading-relaxed text-text-secondary">
                  Rencanakan kegiatan bersama lewat polling satu suara per warung, catat iuran peserta dan dana talangan, lalu hitung daftar transfer penyelesaian secara proporsional.
                </p>
              </div>
              <div className="space-y-2 border-t border-border-strong pt-4">
                <p className="font-mono text-xs text-text-muted">04 / Pemeliharaan</p>
                <h2 className="text-lg font-semibold tracking-tight text-text-primary">
                  Tiket kendala fasilitas & dukungan internal
                </h2>
                <p className="text-sm leading-relaxed text-text-secondary">
                  Penyewa dapat mengirim laporan kerusakan air, listrik, atau bangunan lengkap dengan foto privat agar segera ditindaklanjuti pengelola sentra.
                </p>
              </div>
            </div>
          </section>

          {/* Peran & Akses Tertutup */}
          <section
            id="peran-akses"
            className="border-t border-border-subtle bg-surface"
          >
            <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                    Akses tertutup sesuai kewenangan
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary lg:col-span-7">
                  SEBAKUL tidak membuka pendaftaran umum. Seluruh akun dibuat oleh Super Admin dengan kata sandi sementara yang wajib diganti saat pengguna pertama kali masuk.
                </p>
              </div>

              <div className="grid grid-cols-1 divide-y divide-border-subtle rounded-xl border border-border-subtle md:grid-cols-3 md:divide-x md:divide-y-0">
                {ROLES.map((role, index) => (
                  <div key={role.name} className="space-y-2 p-5 sm:p-6">
                    <p className="font-mono text-xs text-text-muted">0{index + 1}</p>
                    <h3 className="text-base font-semibold text-text-primary">{role.name}</h3>
                    <p className="text-sm leading-relaxed text-text-secondary">{role.scope}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-start justify-between gap-4 border-t border-border-subtle pt-8 sm:flex-row sm:items-center">
                <div className="space-y-0.5">
                  <p className="text-base font-semibold text-text-primary">
                    Masuk ke ruang kerja SEBAKUL
                  </p>
                  <p className="text-sm text-text-secondary">
                    Gunakan email terdaftar dari pengelola sentra Anda.
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
                  <Link
                    href={primaryHref}
                    className={buttonVariants({ variant: 'default', size: 'default' })}
                  >
                    <span>{isSignedIn ? 'Buka dashboard' : 'Masuk sekarang'}</span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                  </Link>
                  {!isSignedIn && (
                    <Link
                      href="/auth/reset"
                      className={buttonVariants({ variant: 'secondary', size: 'default' })}
                    >
                      Atur ulang sandi
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        </PageTransition>
      </main>

      <footer className="border-t border-border-subtle bg-canvas">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-xs text-text-muted sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <span>SEBAKUL · Sentra Beverages & Kuliner</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="transition-colors hover:text-text-primary">
              Masuk
            </Link>
            <Link href="/auth/reset" className="transition-colors hover:text-text-primary">
              Lupa kata sandi
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
