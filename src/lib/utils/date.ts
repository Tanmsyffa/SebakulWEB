const JAKARTA_TZ = "Asia/Jakarta";

export function getJakartaDayRange(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: JAKARTA_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (name: string) => Number(parts.find(part => part.type === name)?.value);
  const start = new Date(Date.UTC(value('year'), value('month') - 1, value('day')) - 7 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/**
 * Format a date in WIB (Jakarta timezone) using Intl.DateTimeFormat.
 */
export function formatDateWIB(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: JAKARTA_TZ,
    timeZoneName: "short",
  };

  return new Intl.DateTimeFormat("id-ID", {
    ...defaultOptions,
    ...options,
  }).format(d);
}

/**
 * Format date only (no time) in WIB.
 */
export function formatDateOnlyWIB(date: Date | string): string {
  return formatDateWIB(date, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: JAKARTA_TZ,
    timeZoneName: undefined,
  });
}
