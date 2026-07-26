// Конфигурация вкладок-модулей (блупринт, раздел 6).
import type { UserTrack } from "@/lib/enums";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  phase?: string;
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
      { href: "/leadership", label: "Обзор отдела", icon: "◎" },
      { href: "/leadership/budget", label: "Бюджет отдела", icon: "₽" },
    ],
  },
  {
    title: "Работа",
    items: [
      { href: "/dashboard", label: "Сегодня", icon: "◆" },
      { href: "/tasks", label: "Задачи", icon: "✓" },
      { href: "/deals", label: "Сделки", icon: "⑂", track: "Ads" },
      { href: "/messenger", label: "Мессенджер", icon: "✉" },
      { href: "/assistant", label: "ИИ-ассистент", icon: "✦" },
      { href: "/journal", label: "Журнал", icon: "✎" },
    ],
  },
  {
    title: "Турниры",
    items: [
      { href: "/tournaments/contractors", label: "Контрагенты", icon: "◈", track: "Tournaments" },
      { href: "/tournaments", label: "Турниры и сметы", icon: "♛", track: "Tournaments" },
      { href: "/tournaments/arena", label: "Бронь арены", icon: "▦", track: "Tournaments" },
    ],
  },
  {
    title: "Данные",
    items: [
      { href: "/advertisers", label: "Рекламодатели", icon: "☰", track: "Ads" },
      { href: "/documents", label: "Документы", icon: "❐", track: "Ads" },
      { href: "/knowledge", label: "База знаний", icon: "◈" },
      { href: "/team", label: "Команда", icon: "◉" },
    ],
  },
  {
    title: "Финансы и реклама",
    items: [
      { href: "/finances", label: "Финансы", icon: "₽", track: "Ads" },
      { href: "/placements", label: "Календарь размещений", icon: "▦", track: "Ads" },
      { href: "/ord", label: "ОРД / маркировка", icon: "❖", track: "Ads" },
      { href: "/promo", label: "Промокоды", icon: "%", track: "Ads" },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);
