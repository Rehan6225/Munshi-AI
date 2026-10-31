import { CATEGORY_GROUPS, CATEGORY_INFO, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

/** Native select, grouped into Commitments / Essentials / Lifestyle / Money moves. */
export function CategorySelect({
  value,
  onChange,
  label,
  className,
}: {
  value: Category;
  onChange: (c: Category) => void;
  label: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Category)}
      aria-label={label}
      className={cn(
        "cursor-pointer rounded-md bg-transparent px-1 py-0.5 transition hover:bg-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {CATEGORY_GROUPS.map(({ group, categories }) => (
        <optgroup key={group} label={group} className="bg-popover">
          {categories.map((c) => (
            <option key={c} value={c} className="bg-popover">
              {CATEGORY_INFO[c].emoji} {c}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
