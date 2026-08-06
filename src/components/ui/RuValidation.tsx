"use client";

import { useEffect } from "react";

// Браузер показывает подсказки валидации на языке ОС («Please select an item
// in the list»). Сервис русскоязычный, поэтому подменяем сообщения на свои —
// один слушатель на всё приложение, поля менять не нужно.
export function RuValidation() {
  useEffect(() => {
    const message = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string => {
      const v = el.validity;
      if (v.valueMissing) {
        if (el.tagName === "SELECT") return "Выберите вариант из списка";
        const type = (el as HTMLInputElement).type;
        if (type === "checkbox" || type === "radio") return "Поставьте отметку";
        if (type === "date") return "Укажите дату";
        return "Заполните это поле";
      }
      if (v.typeMismatch) {
        const type = (el as HTMLInputElement).type;
        if (type === "email") return "Введите адрес почты целиком, например name@colizeum.ru";
        if (type === "url") return "Введите ссылку целиком, вместе с https://";
        return "Проверьте, что значение введено правильно";
      }
      if (v.rangeUnderflow) return "Число слишком маленькое";
      if (v.rangeOverflow) return "Число слишком большое";
      if (v.stepMismatch) return "Такое значение не подходит";
      if (v.tooShort) return "Слишком коротко";
      if (v.tooLong) return "Слишком длинно";
      if (v.patternMismatch) return "Формат не подходит";
      if (v.badInput) return "Проверьте, что введены только цифры";
      return "Проверьте это поле";
    };

    const onInvalid = (e: Event) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (!el || typeof el.setCustomValidity !== "function") return;
      el.setCustomValidity("");
      if (!el.validity.valid) el.setCustomValidity(message(el));
    };

    // Как только человек начал править поле — снимаем своё сообщение,
    // иначе оно «залипает» и форма перестаёт отправляться.
    const onEdit = (e: Event) => {
      const el = e.target as HTMLInputElement | null;
      if (el && typeof el.setCustomValidity === "function") el.setCustomValidity("");
    };

    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
    };
  }, []);

  return null;
}
