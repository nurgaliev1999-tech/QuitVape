export const TECHNIQUES = [
  {
    category: 'breathing',
    categoryLabel: 'Дыхательная',
    title: 'Дыхание 4-7-8',
    desc: 'Вдохни через нос на 4 счёта, задержи дыхание на 7 счётов, медленно выдохни через рот на 8 счётов. Повтори 2–3 раза.'
  },
  {
    category: 'breathing',
    categoryLabel: 'Дыхательная',
    title: 'Медленный выдох',
    desc: 'Сделай глубокий вдох на 4 счёта и очень медленный выдох на 8–10 счётов. Повтори 4–5 раз, концентрируясь только на дыхании.'
  },
  {
    category: 'physical',
    categoryLabel: 'Физическая',
    title: '20 приседаний',
    desc: 'Сделай 20 приседаний в своём темпе. Физическая нагрузка перебивает тягу почти так же быстро, как никотин.'
  },
  {
    category: 'physical',
    categoryLabel: 'Физическая',
    title: 'Сжатие кулака',
    desc: 'Сожми кулак изо всех сил на 10 секунд, затем резко разожми. Повтори 5 раз на каждую руку.'
  },
  {
    category: 'physical',
    categoryLabel: 'Физическая',
    title: 'Короткая прогулка',
    desc: 'Пройдись быстрым шагом 2–3 минуты — неважно куда. Смена обстановки и движение сбивают тягу.'
  },
  {
    category: 'oral',
    categoryLabel: 'Замена жеста рука-рот',
    title: 'Стакан воды',
    desc: 'Медленно выпей стакан воды, маленькими глотками. Занимает руки и рот на пару минут.'
  },
  {
    category: 'oral',
    categoryLabel: 'Замена жеста рука-рот',
    title: 'Жвачка',
    desc: 'Возьми жвачку и жуй её осознанно минуту-две, концентрируясь на вкусе.'
  },
  {
    category: 'oral',
    categoryLabel: 'Замена жеста рука-рот',
    title: 'Семечки',
    desc: 'Пощёлкай семечки — руки и рот заняты, процесс сам по себе отвлекает.'
  },
  {
    category: 'cognitive',
    categoryLabel: 'Отвлечение',
    title: 'Пять предметов вокруг',
    desc: 'Назови вслух или про себя пять предметов, которые видишь прямо сейчас, с деталями по каждому.'
  },
  {
    category: 'cognitive',
    categoryLabel: 'Отвлечение',
    title: 'Напиши сообщение',
    desc: 'Напиши короткое сообщение кому-то — спроси, как дела, или просто расскажи, что делаешь.'
  },
  {
    category: 'cognitive',
    categoryLabel: 'Отвлечение',
    title: 'Короткое видео',
    desc: 'Посмотри одно короткое видео (30–60 секунд). Этого обычно хватает, чтобы тяга начала спадать.'
  }
];

let lastIndex = -1;

export function pickTechnique() {
  if (TECHNIQUES.length === 1) return TECHNIQUES[0];
  let idx;
  do {
    idx = Math.floor(Math.random() * TECHNIQUES.length);
  } while (idx === lastIndex);
  lastIndex = idx;
  return TECHNIQUES[idx];
}
