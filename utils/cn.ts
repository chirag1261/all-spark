import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose Tailwind class strings: clsx handles conditionals/arrays, tailwind-merge
 * resolves conflicting utilities so a caller-supplied className always wins. Pass
 * the base classes first and the incoming `className` last.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
