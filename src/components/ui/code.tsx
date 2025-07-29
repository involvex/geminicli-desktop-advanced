import { cn } from "@/lib/utils";

function Code({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <code
      className={cn(
        "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm dark:bg-stone-700",
        className
      )}
    >
      {children}
    </code>
  );
}

export { Code };
