import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
}

export const Logo = ({ className, variant = "dark", size = "md" }: LogoProps) => {
  const sizes = {
    sm: { icon: "h-6 w-6", text: "text-lg" },
    md: { icon: "h-8 w-8", text: "text-xl" },
    lg: { icon: "h-10 w-10", text: "text-2xl" },
  };
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex items-center justify-center rounded-lg bg-gradient-primary shadow-glow", sizes[size].icon)}>
        <Layers className="h-1/2 w-1/2 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <span className={cn("font-bold tracking-tight", sizes[size].text, variant === "light" ? "text-white" : "text-foreground")}>
        PageFlow
      </span>
    </div>
  );
};
