'use client';

import * as React from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportCSV } from '@/lib/export/export-csv';
import type { PDFReportConfig } from '@/lib/export/export-pdf';

interface ExportCSVButtonProps {
  headers: string[];
  rows: (string | number)[][];
  filename: string;
  className?: string;
}

export function ExportCSVButton({
  headers,
  rows,
  filename,
  className,
}: ExportCSVButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      exportCSV(headers, rows, filename);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      aria-busy={loading || undefined}
      aria-label="Ekspor CSV"
      className={className}
    >
      {loading ? (
        <Loader2
          aria-hidden="true"
          className="h-4 w-4 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <FileDown aria-hidden="true" className="h-4 w-4" />
      )}
      <span>CSV</span>
    </Button>
  );
}

interface ExportPDFButtonProps {
  config: PDFReportConfig;
  className?: string;
}

export function ExportPDFButton({ config, className }: ExportPDFButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { exportPDF } = await import('@/lib/export/export-pdf');
      await exportPDF(config);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      aria-busy={loading || undefined}
      aria-label="Ekspor PDF"
      className={className}
    >
      {loading ? (
        <Loader2
          aria-hidden="true"
          className="h-4 w-4 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <FileDown aria-hidden="true" className="h-4 w-4" />
      )}
      <span>PDF</span>
    </Button>
  );
}
