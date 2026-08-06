// Минимальный разбор CSV (RFC 4180): кавычки, экранированные кавычки,
// переносы строк внутри ячейки. Нужен для импорта заявок из Google-таблицы,
// поэтому отдельной зависимости не заводим.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let touched = false; // в текущей строке что-то было (чтобы не плодить пустой хвост)

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      touched = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
      touched = true;
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      touched = false;
    } else if (ch !== "\r") {
      cell += ch;
      touched = true;
    }
  }

  if (touched || cell) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
