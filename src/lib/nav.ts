// Конфигурация вкладок-модулей (блупринт, раздел 6).
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  phase?: string;
};

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Работа",
    items: [
      { href: "/dashboard", label: "Сегодня", icon: "◆" },
      { href: "/tasks", label: "Задачи", icon: "✓" },
      { href: "/deals", label: "Сделки", icon: "⑂" },
      { href: "/journal", label: "Журнал", icon: "✎" },
    ],
  },
  {
    title: "Данные",
    items: [
      { href: "/advertisers", label: "Рекламодатели", icon: "☰" },
      { href: "/documents", label: "Документы", icon: "❐" },
      { href: "/knowledge", label: "База знаний", icon: "◈" },
    ],
  },
  {
    title: "Финансы и реклама",
    items: [
      { href: "/finances", label: "Финансы", icon: "₽" },
      { href: "/placements", label: "Календарь размещений", icon: "▦" },
      { href: "/ord", label: "ОРД / маркировка", icon: "❖" },
      { href: "/promo", label: "Промокоды", icon: "%" },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);
