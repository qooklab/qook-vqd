import {stocks} from "./stocks";
import {readMarketJob} from "./market-screen";
/** Resolve against the persisted official master, including stocks excluded by screening. */
export async function resolveStock(code:string):Promise<readonly [string,string]|undefined>{
  if(!/^[0-9A-Z]{6}$/.test(code))return undefined;
  const known=stocks.find(s=>s[1]===code);
  if(known)return known;
  const job=await readMarketJob();
  const listing=job?.listings.find(s=>s.code===code&&s.group==="ST");
  return listing?[listing.name,listing.code]:undefined;
}
