// Конфигурация вкладок-модулей (блупринт, раздел 6).
//
// Названия — «человеческие», а не канцелярские: сервис для своего отдела,
// он помощник, а не начальник. Смысл раздела при этом должен читаться
// с первого взгляда — играем словами только там, где не теряется ясность.
import type { UserTrack } from "@/lib/enums";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  phase?: string;
  // Подпись под пунктом в развёрнутом меню — подсказывает новичку, что внутри.
  hint?: string;
  // track — пункт виден только сотрудникам этого направления (руководитель видит всё).
  // Отсутствие track = пункт общий для всех.
  track?: UserTrack;
};

// leadershipOnly — группа видна только руководителю.
export const NAV_GROUPS: { title: string; items: NavItem[]; leadershipOnly?: boolean }[] = [
  {
    title: "Штурвал",
    leadershipOnly: true,
    items: [
      { href: "/leadership", label: "Пульс отдела", icon: "◎", hint: "Кто чем занят и как идут сделки" },
      { href: "/leadership/budget", label: "Деньги отдела", icon: "₽", hint: "Доходы, расходы, остаток бюджета" },
    ],
  },
  {
    title: "Каждый день",
    items: [
      { href: "/dashboard", label: "Мой день", icon: "◆", hint: "Что важно сегодня" },
      { href: "/tasks", label: "Мои дела", icon: "✓", hint: "Доска задач" },
      { href: "/deals", label: "Сделки", icon: "⑂", hint: "Воронка от лида до закрытия", track: "Ads" },
      { href: "/messenger", label: "Болталка", icon: "✉", hint: "Чат отдела и личные сообщения" },
      { href: "/assistant", label: "Напарник ИИ", icon: "✦", hint: "Спросить про клиентов и сделки" },
      { href: "/journal", label: "Дневник", icon: "✎", hint: "Итоги дня и заметки" },
    ],
  },
  {
    title: "Турниры",
    items: [
      { href: "/tournaments/contractors", label: "Партнёры", icon: "◈", hint: "Кто с нами проводит турниры", track: "Tournaments" },
      { href: "/tournaments", label: "Турниры и сметы", icon: "♛", hint: "Планы и расходы по турнирам", track: "Tournaments" },
      { href: "/tournaments/arena", label: "Арена", icon: "▦", hint: "Бронь площадки на Шелепихе", track: "Tournaments" },
    ],
  },
  {
    title: "Наша база",
    items: [
      { href: "/advertisers", label: "Клиенты", icon: "☰", hint: "Карточки рекламодателей", track: "Ads" },
      { href: "/documents", label: "Документы", icon: "❐", hint: "Договоры, приложения, акты", track: "Ads" },
      { href: "/knowledge", label: "Шпаргалки", icon: "◈", hint: "Как у нас всё устроено" },
      { href: "/leads", label: "Входящие с сайта", icon: "⚑", hint: "Обращения с colizeum-agency.ru" },
      { href: "/team", label: "Команда", icon: "◉", hint: "Сотрудники и доступы" },
    ],
  },
  {
    title: "Деньги и эфир",
    items: [
      { href: "/finances", label: "Деньги", icon: "₽", hint: "Платежи по клиентам", track: "Ads" },
      { href: "/placements", label: "Сетка размещений", icon: "▦", hint: "Что и когда выходит", track: "Ads" },
      { href: "/ord", label: "Маркировка ОРД", icon: "❖", hint: "ЕРИД, креативы, акты", track: "Ads" },
      { href: "/promo", label: "Промокоды", icon: "%", hint: "Коды и взаиморасчёты", track: "Ads" },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);
