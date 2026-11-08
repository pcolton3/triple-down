import { Card } from '@/components/shared/card';
import { formatCurrency } from '@/lib/utils/currency';
import {
  FORMAT_LABELS,
  buildSchedule,
  buyInBreakdown,
  formatEventDate,
  formatTime,
  mapsLink,
  safeLink,
  type GolfEvent,
} from '@/lib/events/golf-events';

function LinkOut({ href, children }: { href: string; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0f5132] underline">
      {children}
    </a>
  );
}

export function eventDateRange(event: Pick<GolfEvent, 'days' | 'agenda'>) {
  const dates = [...event.days.map((day) => day.date), ...event.agenda.map((item) => item.date)].filter(Boolean).sort();
  if (!dates.length) return '';
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first === last) return formatEventDate(first, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return `${formatEventDate(first, { month: 'long', day: 'numeric' })} – ${formatEventDate(last, { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

export function EventSchedule({ event }: { event: GolfEvent }) {
  const schedule = buildSchedule(event);
  if (!schedule.length) return null;
  return (
    <Card>
      <h2 className="mb-3 text-xl font-bold">Weekend schedule</h2>
      <div className="space-y-5">
        {schedule.map(({ date, items }) => (
          <section key={date}>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{formatEventDate(date)}</h3>
            <ol className="space-y-2">
              {items.map((entry) => {
                if (entry.kind === 'golf' && entry.day) {
                  const day = entry.day;
                  return (
                    <li key={entry.key} className="rounded-xl border border-[#c9d8c7] bg-[#f3f8f2] p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#0f5132]">
                        {day.teeTime ? `${formatTime(day.teeTime)} · ` : ''}Golf · Day {day.day}
                      </p>
                      <p className="mt-1 text-lg font-bold">{day.course || 'Course to be announced'}</p>
                      <p className="text-sm text-slate-600">{FORMAT_LABELS[day.format]}</p>
                      {day.address ? <p className="mt-1 text-sm"><LinkOut href={mapsLink(day.address)}>{day.address}</LinkOut></p> : null}
                      {day.website ? <p className="mt-1 text-sm"><LinkOut href={safeLink(day.website)}>Course website</LinkOut></p> : null}
                      {day.notes ? <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{day.notes}</p> : null}
                    </li>
                  );
                }
                const item = entry.item!;
                return (
                  <li key={entry.key} className="rounded-xl border border-slate-200 bg-white p-3">
                    {item.time ? <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{formatTime(item.time)}</p> : null}
                    <p className="font-bold">{item.title}</p>
                    {item.location ? <p className="text-sm text-slate-700">{item.location}</p> : null}
                    {item.address ? <p className="text-sm"><LinkOut href={mapsLink(item.address)}>{item.address}</LinkOut></p> : null}
                    {item.link ? <p className="text-sm"><LinkOut href={safeLink(item.link)}>Details</LinkOut></p> : null}
                    {item.notes ? <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{item.notes}</p> : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </Card>
  );
}

export function BuyInCard({ event, players }: { event: GolfEvent; players: number }) {
  if (!event.buy_in) return null;
  const breakdown = buyInBreakdown(event, players);
  return (
    <Card>
      <h2 className="text-xl font-bold">Buy-in: {formatCurrency(event.buy_in)} per player</h2>
      <p className="mb-3 text-sm text-slate-500">
        Pots shown for {players} player{players === 1 ? '' : 's'} signed up so far.
      </p>
      <div className="divide-y divide-slate-100 text-sm">
        {breakdown.lines.map((line) => (
          <div key={line.label} className="flex items-center justify-between gap-3 py-2">
            <span>{line.label}</span>
            <span className="text-right tabular-nums">
              <span className="font-semibold">{formatCurrency(line.perPlayer)}</span>
              <span className="text-slate-500"> each · {formatCurrency(line.pot)} pot</span>
            </span>
          </div>
        ))}
      </div>
      {breakdown.unallocated !== 0 ? (
        <p className="mt-2 text-xs text-amber-700">
          {formatCurrency(Math.abs(breakdown.unallocated))} of the buy-in is {breakdown.unallocated > 0 ? 'not assigned to a game' : 'over-assigned'}.
        </p>
      ) : null}
    </Card>
  );
}
