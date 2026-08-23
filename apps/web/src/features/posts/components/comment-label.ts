export function commentLabel(count: number): string {
  return `${count} ${count === 1 ? 'comment' : 'comments'}`;
}
