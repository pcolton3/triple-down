type Props = {
  count: number;
  onPress: () => void;
};

export function PressControl({ count, onPress }: Props) {
  return (
    <button
      type="button"
      className="rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white"
      onClick={onPress}
    >
      Press x{count}
    </button>
  );
}
