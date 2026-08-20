const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isYmd(value: string): boolean {
  if (!YMD_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return day >= 1 && day <= daysInMonth(year, month);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function parseYmd(value: string): { year: number; month: number; day: number } {
  if (!isYmd(value)) throw new Error(`Invalid YYYY-MM-DD date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function compareYmd(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function birthdayDateForYear(dobYmd: string, year: number): string {
  const { month, day } = parseYmd(dobYmd);
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return formatYmd(year, 2, 28);
  }
  return formatYmd(year, month, Math.min(day, daysInMonth(year, month)));
}

export function birthdayAgeForYear(dobYmd: string, year: number): number {
  const { year: birthYear } = parseYmd(dobYmd);
  return year - birthYear;
}

export function addCalendarMonthsClamped(ymd: string, deltaMonths: number): string {
  const { year, month, day } = parseYmd(ymd);
  const zeroBased = month - 1 + deltaMonths;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonthIndex = ((zeroBased % 12) + 12) % 12;
  const targetMonth = targetMonthIndex + 1;
  return formatYmd(
    targetYear,
    targetMonth,
    Math.min(day, daysInMonth(targetYear, targetMonth)),
  );
}

export type BirthdayCouponSchedule = {
  birthdayYear: number;
  birthdayDate: string;
  sendOn: string;
};

export function nextBirthdayCouponSchedule(
  dobYmd: string,
  asOfYmd: string,
): BirthdayCouponSchedule {
  if (!isYmd(asOfYmd)) throw new Error(`Invalid as-of date: ${asOfYmd}`);
  let { year } = parseYmd(asOfYmd);
  let birthdayDate = birthdayDateForYear(dobYmd, year);
  if (compareYmd(birthdayDate, asOfYmd) < 0) {
    year += 1;
    birthdayDate = birthdayDateForYear(dobYmd, year);
  }
  return {
    birthdayYear: year,
    birthdayDate,
    sendOn: addCalendarMonthsClamped(birthdayDate, -1),
  };
}

export function isScheduleDue(
  schedule: BirthdayCouponSchedule,
  asOfYmd: string,
): boolean {
  return compareYmd(schedule.sendOn, asOfYmd) <= 0 &&
    compareYmd(asOfYmd, schedule.birthdayDate) <= 0;
}
