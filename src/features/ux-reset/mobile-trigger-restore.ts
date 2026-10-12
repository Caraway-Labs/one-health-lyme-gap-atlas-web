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
