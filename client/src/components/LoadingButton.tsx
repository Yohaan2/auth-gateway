import { Loader2 } from "lucide-react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

export default function LoadingButton({
  loading = false,
  disabled,
  children,
  className = "",
  ...rest
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />}
      {children}
    </button>
  );
}
