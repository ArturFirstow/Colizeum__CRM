/**
 * Сверка: то, что API отдаёт на самом деле, и то, что написано в его описании.
 *
 * Зачем. У публичного контура три вещи обязаны совпадать: выдача, машинное
 * описание (OpenAPI) и документация. Строятся они из одного списка
 * (src/lib/services/api-registry.ts), поэтому разъехаться почти не могут —
 * но «почти» здесь мало. Если кто-то допишет поле в функцию выдачи и забудет
 * описать его, коннектор получит поле, которого «по описанию» не существует.
 *
 * Скрипт ловит ровно это. Базы и запущенного сервера не требует.
 *
 * Запуск:  npm run api:check
 */
import { API_REGISTRY } from "../src/lib/services/api-registry";

function main() {
  let bad = 0;
  console.log("\nСверка выдачи API с описанием\n");

  for (const [path, spec] of Object.entries(API_REGISTRY)) {
    // Пустая запись: значения будут undefined, но НАБОР ключей — настоящий,
    // ровно тот, что уйдёт наружу.
    const produced = new Set(Object.keys(spec.shape({ id: "", updatedAt: new Date() })));
    const described = new Set(Object.keys(spec.fields));

    const undocumented = [...produced].filter((k) => !described.has(k));
    const missing = [...described].filter((k) => !produced.has(k));

    if (undocumented.length === 0 && missing.length === 0) {
      console.log(`  ✓ ${path.padEnd(24)} ${produced.size} полей, все описаны`);
      continue;
    }
    bad++;
    console.log(`  ✗ ${path}`);
    if (undocumented.length) console.log(`      отдаются, но не описаны: ${undocumented.join(", ")}`);
    if (missing.length) console.log(`      описаны, но не отдаются: ${missing.join(", ")}`);
  }

  console.log(
    bad === 0
      ? "\nВсё сходится: описание и выдача совпадают поле в поле.\n"
      : `\nРазделов с расхождением: ${bad}. Поправьте src/lib/services/api-registry.ts.\n`,
  );
  if (bad > 0) process.exitCode = 1;
}

main();
