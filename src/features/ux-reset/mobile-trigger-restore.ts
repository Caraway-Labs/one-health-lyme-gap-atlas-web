/**
 * The Escape press that closed the drawer, including auto-repeat while that
 * key is still down, must not cancel the focus restore that press started.
 * A later Escape is a new press: it is not a repeat, and its timestamp is
 * after the restore listener attached.
 */
export function escapeStillClosingNavigation(
  event: Event,
  restoreAttachedAt: number
): boolean {
  if (!(event instanceof KeyboardEvent) || event.key !== "Escape") {
    return false;
  }
  return event.repeat || event.timeStamp <= restoreAttachedAt;
}

export function mobileTriggerRestoreShouldStop(
  event: Event,
  trigger: EventTarget
): boolean {
  if (
    event instanceof KeyboardEvent &&
    (event.key === "Tab" || event.key === "Escape")
  ) {
    return true;
  }
  return event.target !== trigger;
}

export function trustedMobileTriggerRestoreShouldStop(
  event: Event,
  trigger: EventTarget
): boolean {
  if (!event.isTrusted) {
    return false;
  }
  return mobileTriggerRestoreShouldStop(event, trigger);
}
