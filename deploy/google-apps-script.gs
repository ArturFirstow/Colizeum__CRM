/**
 * Colizeum Agency — приёмник строк из «Дневника» в таблицу отчётности.
 *
 * Что делает: получает JSON из сервиса, находит в шапке листа колонки ПО ИХ
 * НАЗВАНИЯМ и дописывает новую строку. Колонки можно переставлять, добавлять
 * и переименовывать — код менять не нужно.
 *
 * Установка — см. docs/MEETINGS_SHEET.md.
 * Не забудьте поменять TOKEN на свой (та же строка идёт в .env сервиса).
 */

var TOKEN = "ПОМЕНЯЙТЕ_НА_СВОЮ_ДЛИННУЮ_СТРОКУ";

// Лист по умолчанию. Пустая строка — активный (первый) лист таблицы.
var DEFAULT_SHEET = "";

// Синонимы: слева — как может называться колонка в вашей таблице,
// справа — ключ, который присылает сервис. Сравнение без учёта регистра,
// пробелов и знаков препинания.
var ALIASES = {
  дата: "Дата встречи",
  датавстречи: "Дата встречи",
  деньвстречи: "Дата встречи",
  времяначала: "Время начала",
  началовстречи: "Время начала",
  начало: "Время начала",
  времяокончания: "Время окончания",
  окончаниевстречи: "Время окончания",
  окончание: "Время окончания",
  конец: "Время окончания",
  датаокончаниявстречи: "Время окончания",
  продолжительность: "Продолжительность",
  длительность: "Продолжительность",
  часы: "Продолжительность",
  количествочасов: "Продолжительность",
  участники: "Участники",
  участниквстречи: "Участники",
  участникивстречи: "Участники",
  скемвстреча: "С кем встреча",
  контрагент: "Клиент",
  клиент: "Клиент",
  компания: "Клиент",
  сотрудник: "Сотрудник",
  менеджер: "Сотрудник",
  ответственный: "Сотрудник",
  ссылканапротокол: "Ссылка на протокол",
  протокол: "Ссылка на протокол",
  ссылканавстречу: "Ссылка на встречу",
  ссылканазапись: "Ссылка на встречу",
  запись: "Ссылка на встречу",
  комментарий: "Комментарий",
  примечание: "Комментарий",
  итоги: "Комментарий",
};

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]/g, "");
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (TOKEN && body.token !== TOKEN) {
      return json({ ok: false, error: "Неверный токен" });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var name = body.sheet || DEFAULT_SHEET;
    var sheet = name ? ss.getSheetByName(name) : ss.getSheets()[0];
    if (!sheet) return json({ ok: false, error: "Лист не найден: " + name });

    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) return json({ ok: false, error: "В листе нет колонок" });
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // Собираем строку под ширину шапки: каждая колонка получает своё значение.
    var row = new Array(lastCol).fill("");
    var used = {};
    for (var i = 0; i < headers.length; i++) {
      var key = normalize(headers[i]);
      if (!key) continue;
      // Сначала пробуем точное совпадение названия, потом словарь синонимов.
      var value = null;
      for (var k in body.row) {
        if (normalize(k) === key) {
          value = body.row[k];
          break;
        }
      }
      if (value === null && ALIASES[key] && body.row[ALIASES[key]] !== undefined) {
        value = body.row[ALIASES[key]];
      }
      if (value !== null && value !== undefined && value !== "") {
        row[i] = value;
        used[normalize(ALIASES[key] || headers[i])] = true;
      }
    }

    sheet.appendRow(row);
    return json({ ok: true, row: sheet.getLastRow() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// Открыть адрес в браузере — быстрая проверка, что скрипт опубликован.
function doGet() {
  return json({ ok: true, service: "colizeum-meetings" });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
