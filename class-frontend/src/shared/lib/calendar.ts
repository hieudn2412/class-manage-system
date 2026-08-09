const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

const businessDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const businessDateTimeParts = (value: string): Record<string, string> =>
  Object.fromEntries(
    businessDateTimeFormatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

const readDateParts = (value: string): [number, number, number] => {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error(`Ngày không hợp lệ: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

export const formatDateKey = (date: Date): string =>
  `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;

export const addCalendarDays = (dateKey: string, days: number): string => {
  const [year, month, day] = readDateParts(dateKey);
  return formatDateKey(new Date(Date.UTC(year, month - 1, day + days)));
};

export const getIsoWeekday = (dateKey: string): number => {
  const [year, month, day] = readDateParts(dateKey);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
};

export const getWeekStart = (dateKey: string): string =>
  addCalendarDays(dateKey, 1 - getIsoWeekday(dateKey));

export const getWeekEnd = (weekStart: string): string => addCalendarDays(weekStart, 6);

export const toBusinessIso = (dateKey: string, time: string): string =>
  `${dateKey}T${time}:00+07:00`;

export const dateKeyFromIso = (value: string): string => {
  const parts = businessDateTimeParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const timeFromIso = (value: string): string => {
  const parts = businessDateTimeParts(value);
  return `${parts.hour}:${parts.minute}`;
};

export const minutesFromTime = (value: string): number => {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export const intervalsOverlap = (
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
): boolean =>
  Date.parse(leftStart) < Date.parse(rightEnd) && Date.parse(rightStart) < Date.parse(leftEnd);

export const getTodayInBusinessTimezone = (): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
};

export const getWeekDateKeys = (weekStart: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
