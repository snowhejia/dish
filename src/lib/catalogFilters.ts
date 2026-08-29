import type { Dish, DishVersion } from '@/data/mockData';

export type DishKindFilter = 'Soupy' | 'Spicy';
export type DiscoverFilter = DishKindFilter | 'Under $20' | '5 min walk' | 'Open now';

export function normalizeCatalogText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchableDishText(dish: Dish, dishVersions: DishVersion[]) {
  return normalizeCatalogText([
    dish.name,
    dish.cuisine,
    dish.dishType,
    dish.description,
    ...dishVersions.flatMap((version) => [
      version.menuName,
      version.restaurant,
      version.cuisine,
      version.dishType,
      version.address,
      ...version.tags,
    ]),
  ].filter(Boolean).join(' '));
}

export function searchableRestaurantText(name: string, restaurantVersions: DishVersion[]) {
  return normalizeCatalogText([
    name,
    ...restaurantVersions.flatMap((version) => [
      version.menuName,
      version.cuisine,
      version.dishType,
      version.address,
      version.distanceLabel,
      ...version.tags,
    ]),
  ].filter(Boolean).join(' '));
}

export function versionMatchesKind(dish: Dish, version: DishVersion, kind: DishKindFilter) {
  const text = normalizeCatalogText([
    dish.name,
    dish.cuisine,
    dish.dishType,
    version.menuName,
    version.cuisine,
    version.dishType,
    ...version.tags,
  ].filter(Boolean).join(' '));

  return kind === 'Soupy'
    ? /\b(soup|soupy|ramen|broth|bisque|hotpot|stew)\b/.test(text)
    : /\b(spicy|chilli|chili|mala|sichuan|tan[ -]?tan|tantan)\b/.test(text);
}

export function versionMatchesDiscoverFilter(
  dish: Dish,
  version: DishVersion,
  filter: DiscoverFilter,
  now = new Date(),
) {
  switch (filter) {
    case 'Soupy':
    case 'Spicy':
      return versionMatchesKind(dish, version, filter);
    case 'Under $20':
      return version.price < 20;
    case '5 min walk':
      return hasKnownDistance(version) && version.metres <= 450;
    case 'Open now':
      return isVersionOpenNow(version, now);
  }
}

export function hasKnownDistance(version: DishVersion) {
  return Number.isFinite(version.metres) && version.metres > 0;
}

/**
 * Best-effort evaluation of the imported venue schedules. The first release
 * stores the human-readable schedule, so this parser handles the formats in
 * realData.ts (day ranges, split shifts, AM/PM, and overnight closing).
 */
export function isVersionOpenNow(version: DishVersion, now = new Date()) {
  if (!version.hours?.trim()) {
    // Bundled prototype venues intentionally represent the old “open now”
    // demo content. Live/admin records without hours remain unknown/closed.
    return version.source !== 'real' && version.source !== 'admin';
  }

  const schedule = parseHours(version.hours);
  const current = sydneyClock(now);
  const today = schedule.get(current.day) ?? [];
  if (today.some((interval) => containsMinute(interval, current.minute, false))) return true;

  const previousDay = (current.day + 6) % 7;
  const previous = schedule.get(previousDay) ?? [];
  return previous.some((interval) => containsMinute(interval, current.minute, true));
}

type TimeInterval = { opens: number; closes: number };

function containsMinute(interval: TimeInterval, minute: number, fromPreviousDay: boolean) {
  if (interval.opens === interval.closes) return true;
  const overnight = interval.closes < interval.opens;
  if (fromPreviousDay) return overnight && minute < interval.closes;
  return overnight
    ? minute >= interval.opens
    : minute >= interval.opens && minute < interval.closes;
}

function parseHours(value: string) {
  const normalized = value
    .replace(/[–—]/g, '-')
    .replace(/：/g, ':')
    .replace(/；/g, ';');
  const dayName = '(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)';
  const header = new RegExp(`(${dayName}|Weekdays?|Weekends?|Daily|Every day)(?:\\s*-\\s*(${dayName}))?\\s*:?\\s*`, 'gi');
  const matches = [...normalized.matchAll(header)];
  const schedule = new Map<number, TimeInterval[]>();

  matches.forEach((match, index) => {
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = matches[index + 1]?.index ?? normalized.length;
    const content = normalized.slice(contentStart, contentEnd);
    if (/closed/i.test(content) && !/\d/.test(content)) return;

    const days = expandDays(match[1] ?? '', match[2]);
    const intervals = parseIntervals(content);
    if (/24\s*hours/i.test(content)) intervals.push({ opens: 0, closes: 0 });
    days.forEach((day) => {
      const current = schedule.get(day) ?? [];
      current.push(...intervals);
      schedule.set(day, current);
    });
  });

  return schedule;
}

function parseIntervals(value: string): TimeInterval[] {
  const expression = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/gi;
  return [...value.matchAll(expression)].flatMap((match) => {
    const opens = timeToMinute(match[1], match[2], match[3]);
    const closes = timeToMinute(match[4], match[5], match[6]);
    return opens === null || closes === null ? [] : [{ opens, closes }];
  });
}

function timeToMinute(hourValue?: string, minuteValue?: string, periodValue?: string) {
  let hour = Number.parseInt(hourValue ?? '', 10);
  const minute = Number.parseInt(minuteValue ?? '0', 10);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  const period = periodValue?.toUpperCase();
  if (period) {
    if (hour < 1 || hour > 12) return null;
    if (period === 'AM') hour %= 12;
    else if (period === 'PM') hour = (hour % 12) + 12;
  } else if (hour < 0 || hour > 23) {
    return null;
  }
  return hour * 60 + minute;
}

function expandDays(startValue: string, endValue?: string) {
  const normalized = startValue.toLowerCase();
  if (normalized.startsWith('weekday')) return [1, 2, 3, 4, 5];
  if (normalized.startsWith('weekend')) return [6, 0];
  if (normalized === 'daily' || normalized === 'every day') return [0, 1, 2, 3, 4, 5, 6];

  const start = dayNumber(startValue);
  const end = endValue ? dayNumber(endValue) : start;
  if (start === null || end === null) return [];
  const days = [start];
  while (days.at(-1) !== end && days.length < 7) days.push(((days.at(-1) ?? start) + 1) % 7);
  return days;
}

function dayNumber(value: string) {
  const key = value.slice(0, 3).toLowerCase();
  const days: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  return days[key] ?? null;
}

function sydneyClock(value: Date) {
  try {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
    const day = dayNumber(part('weekday') ?? '');
    const hour = Number.parseInt(part('hour') ?? '', 10);
    const minute = Number.parseInt(part('minute') ?? '', 10);
    if (day !== null && Number.isInteger(hour) && Number.isInteger(minute)) {
      return { day, minute: hour * 60 + minute };
    }
  } catch {
    // Older native JS engines can lack named-timezone data; local time is the
    // closest safe fallback for this Sydney-first prototype.
  }
  return { day: value.getDay(), minute: value.getHours() * 60 + value.getMinutes() };
}
