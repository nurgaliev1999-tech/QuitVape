export const MILESTONES = [
  { days: 1, label: '1 день' },
  { days: 3, label: '3 дня' },
  { days: 7, label: 'Неделя' },
  { days: 14, label: '2 недели' },
  { days: 30, label: 'Месяц' },
  { days: 60, label: '2 месяца' },
  { days: 90, label: '3 месяца' },
  { days: 180, label: 'Полгода' },
  { days: 365, label: 'Год' }
];

export function getStreakDays(lastUseAt) {
  const ms = Date.now() - new Date(lastUseAt).getTime();
  return ms / 86400000;
}
