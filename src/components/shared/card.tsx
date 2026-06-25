import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-[#c9d8c7] bg-white p-4 shadow-sm', className)}
      {...props}
    />
  );
}
