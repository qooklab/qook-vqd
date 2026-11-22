export const pinnedStocks = [
  ["하나금융지주", "086790"],
  ["우리금융지주", "316140"],
  ["현대차", "005380"],
  ["삼성화재우", "000815"],
  ["삼성전자우", "005935"],
  ["SK텔레콤", "017670"],
] as const;

const pinnedCodes = new Set<string>(pinnedStocks.map(([, code]) => code));
export const isPinnedStock = (code: string) => pinnedCodes.has(code);

export function withPinnedStocks(ranked: readonly (readonly [string, string])[]) {
  const selected: (readonly [string, string])[] = [...pinnedStocks];
  const seen = new Set(pinnedCodes);
  for (const stock of ranked) {
    if (selected.length >= 30) break;
    if (!seen.has(stock[1])) {
      selected.push(stock);
      seen.add(stock[1]);
    }
  }
  return selected;
}

const preferredIssuers: Record<string, string> = {"000815": "000810", "005935": "005930"};
export const issuerCode = (code: string) => preferredIssuers[code] ?? code;
