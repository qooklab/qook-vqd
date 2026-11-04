export function shouldAnimateNavigation(input: {
  href: string; current: string; button: number; modified: boolean;
  prevented: boolean; download: boolean; target: string; reduced: boolean;
}) {
  if (input.prevented || input.button !== 0 || input.modified || input.download || input.reduced || (input.target && input.target !== "_self")) return false;
  const url = new URL(input.href, input.current), current = new URL(input.current);
  return /^https?:$/.test(url.protocol) && url.origin === current.origin && url.pathname !== current.pathname && !url.hash;
}
