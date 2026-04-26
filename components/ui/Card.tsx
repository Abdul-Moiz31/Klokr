import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = "", hover = false }: CardProps) {
  return (
    <div
      className={`backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl ${
        hover
          ? "hover:bg-white/8 hover:border-white/20 transition-all duration-300"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
