import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({
  className,
  variant = 'primary',
  ...props
}: Props) {
  return (
    <button
      className={cn(
        'rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' && 'bg-[#0f5132] text-white hover:bg-[#0a3a24]',
        variant === 'secondary' &&
          'border border-[#c9d8c7] bg-white text-[#14211b] hover:border-[#0f5132]',
        variant === 'ghost' && 'bg-transparent text-[#14211b]',
        className
      )}
      {...props}
    />
  );
}
