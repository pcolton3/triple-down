type Props = {
  value: number;
  onChange: (next: number) => void;
};

export function WagerControl({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-xl border border-slate-300 px-3 py-2"
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        -
      </button>
      <div className="min-w-16 rounded-xl bg-slate-50 px-3 py-2 text-center font-bold">${value}</div>
      <button
        type="button"
        className="rounded-xl border border-slate-300 px-3 py-2"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
