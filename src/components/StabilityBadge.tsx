type Props = {
  category: string | null;
};

export function StabilityBadge({ category }: Props) {
  if (!category) {
    return <span className="text-gray-400 dark:text-zinc-500">—</span>;
  }

  const isStable = category === "stablecoin" || category === "blue_chip";
  const isMixed = category === "mixed";

  let label: string;
  let colorClass: string;

  if (isStable) {
    label = "Stable";
    colorClass = "text-gray-500 dark:text-zinc-400";
  } else if (isMixed) {
    label = "Mixed";
    colorClass = "text-amber-600 dark:text-amber-400";
  } else {
    label = "Volatile";
    colorClass = "text-red-500 dark:text-red-400";
  }

  return (
    <span className={`inline-flex items-center gap-1 text-sm ${colorClass}`}>
      <span aria-hidden="true">{isStable ? "—" : "\u2197"}</span>
      {label}
    </span>
  );
}
