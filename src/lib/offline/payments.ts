export type PaymentLine = { id: string; label: string; amount: number };
export function paymentKey(roundId: string, line: PaymentLine) {
  return `triple-track-paid:${roundId}:${line.id}:${Math.round(line.amount * 100)}`;
}
