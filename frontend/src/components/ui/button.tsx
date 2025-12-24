/**
 * @module components/ui/button
 * @description Button component (Shadcn/ui style)
 */

import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'md', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-full font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 disabled:opacity-50 disabled:pointer-events-none backdrop-blur-sm';

    const variantStyles = {
      default:
        'border border-white/15 bg-white/10 text-slate-800 shadow-[0_12px_35px_-18px_rgba(16,185,129,0.6)] hover:bg-white/15 hover:text-slate-900',
      primary:
        'bg-emerald-400 text-slate-900 shadow-[0_18px_45px_-20px_rgba(16,185,129,0.85)] hover:bg-emerald-300',
      secondary:
        'bg-white text-slate-900 shadow-[0_12px_35px_-18px_rgba(148,163,184,0.5)] hover:bg-emerald-50',
      danger:
        'bg-rose-500 text-white shadow-[0_18px_45px_-20px_rgba(244,63,94,0.75)] hover:bg-rose-400',
      ghost: 'text-emerald-700 hover:bg-white/10 hover:text-emerald-800',
      outline: 'border border-white/30 text-slate-800 hover:bg-white/10 hover:text-slate-900',
    } as const;

    const sizeStyles = {
      sm: 'h-8 px-4 text-xs tracking-[0.2em] uppercase',
      md: 'h-11 px-6 text-sm tracking-[0.3em] uppercase',
      lg: 'h-12 px-8 text-base tracking-[0.35em] uppercase',
    } as const;
    
    return (
      <button
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
