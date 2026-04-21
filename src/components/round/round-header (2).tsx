type Props = {
  title: string;
  courseName: string;
  holeNumber: number;
  par: number;
};

export function RoundHeader({ title, courseName, holeNumber, par }: Props) {
  return (
    <div className="rounded-2xl bg-[#2f8df3] p-5 text-white">
      <p className="text-sm opacity-90">{courseName}</p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm">Hole {holeNumber} • Par {par} • Banker • Net scoring</p>
    </div>
  );
}
