/** Keep a selected county row inside the list viewport. */
export function alignCandidateRow(list: HTMLElement, row: HTMLElement): void {
  const rowBox = row.getBoundingClientRect();
  const listBox = list.getBoundingClientRect();
  if (rowBox.height <= 0 || list.clientHeight === 0) {
    return;
  }
  if (rowBox.height >= listBox.height) {
    list.scrollTop += rowBox.top - listBox.top;
    return;
  }
  const above = listBox.top - rowBox.top;
  const below = rowBox.bottom - listBox.bottom;
  if (above > 1) {
    list.scrollTop -= above;
    return;
  }
  if (below > 1) {
    list.scrollTop += below;
  }
}
