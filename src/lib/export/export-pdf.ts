import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PDFSummaryItem {
  label: string;
  value: string;
}

export interface PDFExportOptions {
  /** Document title displayed in the header */
  title: string;
  /** Subtitle / description under the title */
  subtitle?: string;
  /** Period string (e.g., "November 2026") */
  period?: string;
  /** 3-column summary cards at the top */
  summary?: [PDFSummaryItem, PDFSummaryItem, PDFSummaryItem];
  /** Table column headers */
  headers: string[];
  /** Table row data (string arrays) */
  rows: string[][];
  /** Output filename (without .pdf extension) */
  filename: string;
  /** Page orientation */
  orientation?: "portrait" | "landscape";
}

export type PDFReportConfig = PDFExportOptions;

/**
 * Generate and download a PDF report with SEBAKUL branding.
 *
 * Features:
 * - SEBAKUL header with teal branding
 * - 3-column summary section
 * - Auto-table with pagination
 * - Page numbers in footer
 *
 * @example
 * exportPDF({
 *   title: "Laporan Transaksi",
 *   subtitle: "Sentra Kuliner Jaya",
 *   period: "November 2026",
 *   summary: [
 *     { label: "Total Pemasukan", value: formatRupiah(5000000) },
 *     { label: "Total Pengeluaran", value: formatRupiah(2000000) },
 *     { label: "Saldo", value: formatRupiah(3000000) },
 *   ],
 *   headers: ["No", "Tanggal", "Kategori", "Tipe", "Jumlah"],
 *   rows: [["1", "16 Nov 2026", "Sewa", "INCOME", "Rp1.500.000"]],
 *   filename: "laporan-transaksi-nov-2026",
 * });
 */
export function exportPDF(options: PDFExportOptions): void {
  const {
    title,
    subtitle,
    period,
    summary,
    headers,
    rows,
    filename,
    orientation = "portrait",
  } = options;

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let yPos = margin;

  // ── Brand Colors ──
  const teal700: [number, number, number] = [15, 118, 110]; // #0F766E
  const stone800: [number, number, number] = [28, 25, 23]; // #1C1917
  const stone500: [number, number, number] = [87, 83, 78]; // #57534E
  const stone200: [number, number, number] = [231, 229, 228]; // #E7E5E4
  const tealLight: [number, number, number] = [204, 251, 241]; // #CCFBF1

  // ── Header Bar ──
  doc.setFillColor(...teal700);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("SEBAKUL", margin, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Sistem Manajemen Sentra Kuliner", margin, 18);

  // Print date on right side
  const printDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.setFontSize(8);
  doc.text(`Dicetak: ${printDate}`, pageWidth - margin, 18, {
    align: "right",
  });

  yPos = 36;

  // ── Title Section ──
  doc.setTextColor(...stone800);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, yPos);
  yPos += 7;

  if (subtitle) {
    doc.setTextColor(...stone500);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, margin, yPos);
    yPos += 5;
  }

  if (period) {
    doc.setTextColor(...stone500);
    doc.setFontSize(10);
    doc.text(`Periode: ${period}`, margin, yPos);
    yPos += 5;
  }

  yPos += 3;

  // ── Summary Cards (3 columns) ──
  if (summary) {
    const cardWidth = (pageWidth - margin * 2 - 8) / 3;
    const cardHeight = 20;

    summary.forEach((item, index) => {
      const x = margin + index * (cardWidth + 4);

      // Card background
      doc.setFillColor(...tealLight);
      doc.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, "F");

      // Card label
      doc.setTextColor(...stone500);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(item.label, x + 4, yPos + 7);

      // Card value
      doc.setTextColor(...teal700);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(item.value, x + 4, yPos + 15);
    });

    yPos += cardHeight + 8;
  }

  // ── Data Table ──
  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: rows,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: stone800,
      lineColor: stone200,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: teal700,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 249], // canvas color
    },
    didDrawPage: (data) => {
      // ── Footer with page numbers ──
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageCount = doc.getNumberOfPages();

      doc.setFontSize(7);
      doc.setTextColor(...stone500);
      doc.text(
        `Halaman ${data.pageNumber} dari ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );

      doc.text(
        "Dokumen ini dihasilkan secara otomatis oleh SEBAKUL",
        pageWidth / 2,
        pageHeight - 4,
        { align: "center" }
      );
    },
  });

  // ── Save ──
  doc.save(`${filename}.pdf`);
}

