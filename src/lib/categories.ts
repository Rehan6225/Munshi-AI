import type { Category } from "./store";

export const CATEGORIES: Category[] = [
  "Food",
  "Groceries",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Other",
];

export function isCategory(value: unknown): value is Category {
  return CATEGORIES.includes(value as Category);
}
