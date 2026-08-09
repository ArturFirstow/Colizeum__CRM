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
    title: "Руководителю",
    leadershipOnly: true,
    items: [
      { href: "/leadership", label: "Обзор отдела", icon: "◎", hint: "Кто чем занят и как идут сделки" },
      { href: "/leadership/budget", label: "Бюджет отдела", icon: "₽", hint: "Доходы, расходы, остаток бюджета" },
    ],
  },
  {
    title: "Работа",
    items: [
      { href: "/dashboard", label: "Сегодня", icon: "◆", hint: "Что важно сегодня" },
      { href: "/tasks", label: "Задачи", icon: "✓", hint: "Доска задач" },
      { href: "/deals", label: "Сделки", icon: "⑂", hint: "Воронка от лида до закрытия", track: "Ads" },
      { href: "/messenger", label: "Мессенджер", icon: "✉", hint: "Чат отдела и личные сообщения" },
      { href: "/assistant", label: "Напарник ИИ", icon: "✦", hint: "Спросить про клиентов и сделки" },
      { href: "/journal", label: "Дневник", icon: "✎", hint: "Итоги дня и заметки" },
    ],
  },
  {
    title: "Турниры",
    items: [
      { href: "/tournaments/contractors", label: "Контрагенты", icon: "◈", hint: "Кто с нами проводит турниры", track: "Tournaments" },
      { href: "/tournaments", label: "Турниры и сметы", icon: "♛", hint: "Планы и расходы по турнирам", track: "Tournaments" },
      { href: "/tournaments/arena", label: "Бронь арены", icon: "▦", hint: "Бронь площадки на Шелепихе", track: "Tournaments" },
    ],
  },
  {
    title: "Данные",
    items: [
      { href: "/advertisers", label: "Клиенты", icon: "☰", hint: "Карточки рекламодателей", track: "Ads" },
      { href: "/documents", label: "Документы", icon: "❐", hint: "Договоры, приложения, акты", track: "Ads" },
      { href: "/knowledge", label: "База знаний", icon: "◈", hint: "Как у нас всё устроено" },
      { href: "/leads", label: "Входящие с сайта", icon: "⚑", hint: "Обращения с colizeum-agency.ru" },
      { href: "/handover", label: "Передача дел", icon: "⇄", hint: "Отпуск: клиенты уходят замещающему" },
      { href: "/team", label: "Команда", icon: "◉", hint: "Сотрудники и доступы" },
    ],
  },
  {
    title: "Финансы и реклама",
    items: [
      { href: "/finances", label: "Оплаты", icon: "₽", hint: "Платежи по клиентам", track: "Ads" },
      { href: "/placements", label: "Календарь размещений", icon: "▦", hint: "Что и когда выходит", track: "Ads" },
      { href: "/ord", label: "ОРД / маркировка", icon: "❖", hint: "ЕРИД, креативы, акты", track: "Ads" },
      { href: "/promo", label: "Промокоды", icon: "%", hint: "Коды и взаиморасчёты", track: "Ads" },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);
