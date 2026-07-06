import { cn } from "@/lib/utils";

export function DotPattern({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none",
        "[background-image:radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)]",
        "[background-size:24px_24px]",
        className
      )}
    />
  );
}
