/**
 * Export data as CSV with UTF-8 BOM for Excel compatibility.
 * Downloads the file as a blob in the browser.
 */

/**
 * Escape a CSV cell value.
 * Wraps in quotes if it contains comma, quote, or newline.
 */
function escapeCSV(value: string): string {
  const safeValue =
    /^[=+@\t\r]/.test(value) || (value.startsWith("-") && value.length > 1 && !/^-Rp[\d.]+$/.test(value))
      ? `'${value}`
      : value;
  if (
    safeValue.includes(",") ||
    safeValue.includes('"') ||
    safeValue.includes("\n") ||
    safeValue.includes("\r")
  ) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

/**
 * Generate and download a CSV file using headers and row arrays.
 *
 * @param headers - Array of header strings
 * @param rows - 2D array of row values (string or number)
 * @param filename - Name of the downloaded file (without extension)
 */
export function exportCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string
): void {
  // UTF-8 BOM for Excel to recognize encoding
  const BOM = "\uFEFF";

  // Build header row
  const headerRow = headers.map(escapeCSV).join(",");

  // Build data rows
  const dataRows = rows.map((row) =>
    row.map((cell) => escapeCSV(String(cell ?? ""))).join(",")
  );

  const csvContent = BOM + [headerRow, ...dataRows].join("\r\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename.endsWith('.csv') ? filename : filename + '.csv'}`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up object URL
  URL.revokeObjectURL(url);
}
