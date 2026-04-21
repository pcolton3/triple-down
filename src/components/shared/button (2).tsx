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
        'rounded-xl px-4 py-3 text-sm font-semibold transition',
        variant === 'primary' && 'bg-[#2f8df3] text-white hover:bg-[#1f7ee6]',
        variant === 'secondary' &&
          'border border-[#68aef7] bg-white text-[#1f2937]',
        variant === 'ghost' && 'bg-transparent text-[#1f2937]',
        className
      )}
      {...props}
    />
  );
}
