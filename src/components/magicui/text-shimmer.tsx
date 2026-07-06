import { cn } from "@/lib/utils";

export function TextShimmer({ children, className, as: Component = "span" }: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <Component
      className={cn(
        "inline-block bg-[linear-gradient(110deg,#6b7280,45%,#f9fafb,55%,#6b7280)] bg-[length:200%_100%] bg-clip-text text-transparent",
        "animate-[shimmer_2s_linear_infinite]",
        className
      )}
    >
      {children}
    </Component>
  );
}
