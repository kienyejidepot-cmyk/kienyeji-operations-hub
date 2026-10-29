import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: number | string | null | undefined): string {
  if (value == null) return "0.00";
  return new Intl.NumberFormat("en-KE", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
