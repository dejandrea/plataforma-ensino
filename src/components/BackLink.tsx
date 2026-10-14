import { Link } from "react-router-dom";

export const BackLink = ({
  to,
  label,
}: {
  to: string;
  label: string;
}) => {
  return (
    <Link
      to={to}
      className="mb-6 inline-flex items-center rounded-2xl bg-surface px-4 py-2.5 text-sm font-semibold text-white/70 ring-1 ring-white/10 transition hover:bg-surface-elevated hover:text-white"
    >
      &lt; {label}
    </Link>
  );
};
