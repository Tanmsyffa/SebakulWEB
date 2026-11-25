import { formatRupiah } from "./currency";

export function generateInvoiceNoticeWAUrl(phone: string, data: {
  invoiceNumber: string; warungName: string; lapakCode: string; periodStart: string;
  dueDate: string; totalAmount: number; paidAmount: number; remainingAmount: number;
}) {
  const digits = phone.replace(/\D/g, '');
  const normalizedPhone = digits.startsWith('0') ? `62${digits.slice(1)}` : digits.startsWith('8') ? `62${digits}` : digits;
  const message = [
    '*INFORMASI TAGIHAN SEWA SEBAKUL*',
    `No. tagihan: ${data.invoiceNumber}`,
    `Warung: ${data.warungName}`,
    `Lapak: ${data.lapakCode}`,
    `Periode: ${data.periodStart.slice(0, 7)}`,
    `Jatuh tempo: ${data.dueDate}`,
    `Total: ${formatRupiah(data.totalAmount)}`,
    `Sudah dibayar: ${formatRupiah(data.paidAmount)}`,
    `Sisa: ${formatRupiah(data.remainingAmount)}`,
    '',
    'Silakan konfirmasi kepada pengelola setelah pembayaran. Pesan ini hanya pemberitahuan; status pembayaran mengikuti pencatatan resmi pada tagihan.',
  ].join('\n');
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
