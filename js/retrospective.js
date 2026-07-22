const TIME_BUCKETS = [
  { label: 'Ночь (0–6)', from: 0, to: 6 },
  { label: 'Утро (6–12)', from: 6, to: 12 },
  { label: 'День (12–18)', from: 12, to: 18 },
  { label: 'Вечер (18–24)', from: 18, to: 24 }
];

const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function buildTimeOfDayStats(journal) {
  const counts = TIME_BUCKETS.map(() => 0);
  for (const entry of journal) {
    const hour = new Date(entry.at).getHours();
    const idx = TIME_BUCKETS.findIndex(b => hour >= b.from && hour < b.to);
    if (idx >= 0) counts[idx]++;
  }
  return TIME_BUCKETS.map((b, i) => ({ label: b.label, count: counts[i] }));
}

export function buildWeekdayStats(journal) {
  const counts = new Array(7).fill(0);
  for (const entry of journal) {
    const day = new Date(entry.at).getDay();
    counts[day]++;
  }
  // Отображаем неделю с понедельника: Пн Вт Ср Чт Пт Сб Вс
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map(i => ({ label: WEEKDAY_LABELS[i], count: counts[i] }));
}

export const REASON_LABELS = {
  stress: 'Стресс',
  boredom: 'Скука',
  habit: 'Привычка',
  company: 'Компания',
  other: 'Другое'
};

export function buildReasonStats(journal) {
  const counts = {};
  for (const entry of journal) {
    const key = entry.reason || 'other';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.keys(REASON_LABELS).map(key => ({
    label: REASON_LABELS[key],
    count: counts[key] || 0
  }));
}
