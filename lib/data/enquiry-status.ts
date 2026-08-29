import { canTransition, type Status } from '../domain/index.ts';

/** Throws if the transition isn't legal, so callers can't persist an illegal status change. */
export function assertValidTransition(from: Status, to: Status): void {
  if (!canTransition(from, to)) {
    throw new Error(`Cannot move an enquiry from "${from}" to "${to}".`);
  }
}
