/** `payTo` is the name of the person receiving the money, used for pay-app buttons. */
export type PaymentLine = { id: string; label: string; amount: number; payTo?: string };
export function paymentKey(roundId: string, line: PaymentLine) {
  return `triple-track-paid:${roundId}:${line.id}:${Math.round(line.amount * 100)}`;
}
