import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TECHNICAL_ERROR_PATTERN =
  /An error occurred in the Server Components render|omitted in production builds|digest|PostgresError|Supabase|Failed to fetch|NetworkError|Load failed|TypeError|SyntaxError|ReferenceError|ECONN|ETIMEDOUT|ENOTFOUND|relation\s+"|column\s+"|violates\s+(unique|foreign|check|not-null)|select\s+.+\s+from\s+|insert\s+into\s+|update\s+.+\s+set\s+|delete\s+from\s+|\/var\/|\.next\/|[A-Za-z]:\\|at\s+\S+\s+\(/i;

export function formatActionError(cause: unknown, fallback: string): string {
  if (!(cause instanceof Error) || !cause.message) return fallback;
  const trimmed = cause.message.trim();
  if (!trimmed || trimmed.length > 200) return fallback;

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Array<{ message?: string }>;
      const firstMsg = Array.isArray(parsed) ? parsed[0]?.message?.trim() : undefined;
      if (firstMsg && !TECHNICAL_ERROR_PATTERN.test(firstMsg) && firstMsg.length <= 200) {
        return firstMsg;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  if (trimmed.startsWith('{') || TECHNICAL_ERROR_PATTERN.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}
