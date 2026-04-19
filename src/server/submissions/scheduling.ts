import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addDays, setHours, setMinutes, setSeconds, setMilliseconds, getDay } from 'date-fns';

const TZ = 'Asia/Seoul';

export function nextBusinessDayNineAm(now: Date = new Date()): Date {
  const kstNow = toZonedTime(now, TZ);
  let candidate = setMilliseconds(setSeconds(setMinutes(setHours(kstNow, 9), 0), 0), 0);
  if (candidate.getTime() <= kstNow.getTime()) candidate = addDays(candidate, 1);
  while (getDay(candidate) === 0 || getDay(candidate) === 6) candidate = addDays(candidate, 1);
  return fromZonedTime(candidate, TZ);
}
