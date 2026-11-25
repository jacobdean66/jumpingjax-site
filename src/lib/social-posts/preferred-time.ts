export const SOCIAL_BUSINESS_TIME_ZONE = "America/New_York";

const formatter=new Intl.DateTimeFormat("en-CA",{
  timeZone:SOCIAL_BUSINESS_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23",
});

export function preferredTimeFields(value: string|null): {date:string;time:string} {
  const instant=new Date(value??"");
  if(!Number.isFinite(instant.getTime()))return {date:"",time:""};
  const fields=Object.fromEntries(formatter.formatToParts(instant).map(part=>[part.type,part.value]));
  return {date:`${fields.year}-${fields.month}-${fields.day}`,time:`${fields.hour}:${fields.minute}`};
}

/** Reject nonexistent and ambiguous wall times instead of choosing a DST side silently. */
export function preferredTimeIso(value: string): string|null {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;
  const nominal=Date.parse(value+"Z");
  if(!Number.isFinite(nominal))return null;
  const offsets=new Set([-86400000,86400000].map(delta=>{
    const sample=nominal+delta;
    const shown=preferredTimeFields(new Date(sample).toISOString());
    return Date.parse(shown.date+"T"+shown.time+"Z")-sample;
  }));
  const matches=[...offsets].map(offset=>new Date(nominal-offset).toISOString()).filter(candidate=>{
    const shown=preferredTimeFields(candidate);
    return shown.date+"T"+shown.time===value;
  });
  return matches.length===1?matches[0]:null;
}
