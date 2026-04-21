type Props = {
  value: number | null;
  onChange: (next: number) => void;
};

export function ScoreInput({ value, onChange }: Props) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-20 rounded-xl border border-slate-300 px-3 py-2 text-center font-bold"
      placeholder="Net"
    />
  );
}
