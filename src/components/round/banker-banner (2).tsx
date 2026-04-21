import { Card } from '@/components/shared/card';
import { Button } from '@/components/shared/button';

type Props = {
  bankerName: string;
};

export function BankerBanner({ bankerName }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Current Banker</p>
          <h2 className="text-2xl font-bold">{bankerName}</h2>
        </div>
        <Button variant="secondary">Change Banker</Button>
      </div>
    </Card>
  );
}
