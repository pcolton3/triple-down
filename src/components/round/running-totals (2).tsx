import { Card } from '@/components/shared/card';
import { formatCurrency } from '@/lib/utils/currency';

type Props = {
  totals: Array<{ name: string; amount: number }>;
};

export function RunningTotals({ totals }: Props) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">Running Totals</h3>
      </div>
      <div className="space-y-2">
        {totals.map((total) => (
          <div
            key={total.name}
            className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"
          >
            <span className="font-medium">{total.name}</span>
            <span className="font-bold">{formatCurrency(total.amount)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
