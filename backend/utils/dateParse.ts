export function parseUserDate(d: string): string {
  if (/^\d{8}$/.test(d)) {
    const matches = d.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (matches) {
      return `${matches[1]}-${matches[2]}-${matches[3]}`;
    }
  }
  return d;
} 