# SEBAKUL

Sistem manajemen operasional sentra kuliner berbasis web untuk pengelola kawasan, penyewa warung, dan administrator platform.

## Teknologi Utama

- **Framework:** Next.js 15 (App Router, React 19, TypeScript)
- **Antarmuka:** Tailwind CSS v4, Lucide Icons, Recharts, Motion
- **Basis Data & Autentikasi:** Supabase (PostgreSQL 17, Auth, Storage, Realtime) & Drizzle ORM

## Persiapan Lokal

1. Pasang dependensi:
   ```bash
   npm install
   ```
2. Salin `.env.example` menjadi `.env.local` lalu lengkapi kredensial proyek Supabase Anda.
3. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```

## Deploy ke Vercel

Proyek sudah dikonfigurasi melalui `vercel.json` untuk berjalan pada region Singapura (`sin1`) agar dekat dengan cluster database `ap-southeast-1`.

1. Unggah repositori ke GitHub lalu impor proyek di dashboard Vercel.
2. Tambahkan Environment Variables berikut pada pengaturan proyek Vercel (Production & Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (gunakan URI **Transaction Pooler** port `6543` dari Supabase Dashboard)
   - `RESEND_API_KEY` (kunci API Resend untuk mengirim email lupa kata sandi)
   - `RESEND_FROM_EMAIL` *(opsional, isi `SEBAKUL <noreply@domainanda.com>` setelah domain diverifikasi di Resend)*
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` *(opsional, Site Key Cloudflare Turnstile untuk proteksi CAPTCHA)*
   - `TURNSTILE_SECRET_KEY` *(opsional, Secret Key Cloudflare Turnstile untuk verifikasi server-side reset kata sandi)*
3. Pada **Supabase Dashboard > Authentication > URL Configuration**, atur **Site URL** ke domain Vercel produksi Anda dan tambahkan `https://<domain-anda>/auth/finish` ke daftar **Redirect URLs**.
4. *(Opsional)* Untuk mengaktifkan CAPTCHA Cloudflare Turnstile, aktifkan **Enable CAPTCHA protection** (pilih **Cloudflare Turnstile**) di **Supabase Dashboard > Authentication > Attack Protection** dan masukkan **Secret Key** yang sama.
