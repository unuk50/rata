import type { Minor } from "./money";

export type EventKind = "home" | "trip" | "party" | "poker" | "gift" | "other";
export type SplitMethod = "equal" | "exact" | "percent" | "shares";

export interface Split {
  method: SplitMethod;
  /**
   * equal: 1 for each member in the split. exact: minor units. percent: basis points (100% = 10000).
   * shares: whole-number weights.
   */
  parts: Record<string, number>;
}

interface Base {
  /** Unique event id. */
  id: string;
  /** Milliseconds since epoch, set by the author's device. */
  ts: number;
  /** Member id of the author, if known. */
  by?: string;
}

export interface GroupEvent extends Base {
  t: "group";
  name: string;
  currency: string;
  kind: EventKind;
}

export interface MemberEvent extends Base {
  t: "member";
  mid: string;
  name: string;
}

export interface ExpenseEvent extends Base {
  t: "expense";
  eid: string;
  desc: string;
  amount: Minor;
  currency: string;
  /** Member id to minor units paid. Values add up to amount. */
  paidBy: Record<string, Minor>;
  split: Split;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  category?: string;
  note?: string;
}

export interface ExpenseDeleteEvent extends Base {
  t: "expense.del";
  eid: string;
}

export interface PaymentEvent extends Base {
  t: "payment";
  pid: string;
  from: string;
  to: string;
  amount: Minor;
  currency: string;
  date: string;
}

export interface PaymentDeleteEvent extends Base {
  t: "payment.del";
  pid: string;
}

export type RataEvent =
  | GroupEvent
  | MemberEvent
  | ExpenseEvent
  | ExpenseDeleteEvent
  | PaymentEvent
  | PaymentDeleteEvent;

/** Event order: time, then id. All devices sort the same way, so all devices agree. */
export function compareEvents(a: Base, b: Base): number {
  return a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Random id, 16 characters. */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => ID_CHARS[b % 36]).join("");
}
