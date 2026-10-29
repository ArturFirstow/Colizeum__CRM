import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, EASE, sec } from "./theme";
import { display, text } from "./fonts";
import {
  Backdrop,
  Chip,
  Counter,
  Kinetic,
  Lower,
  Shot,
  Sub,
  WindowCard,
  XoMark,
  rise,
} from "./components";

// ─────────────────────────────────────────────────────────────────────────────
// Сцены ролика. Тайминги внутри сцены считаны по ЗВУКОВОЙ ДОРОЖКЕ: границы
// сцен — это настоящие паузы в озвучке (их нашёл silencedetect), а движение
// внутри привязано к словам. Поэтому картинка не «попадает примерно», а
// меняется ровно на ударном слове.
// ─────────────────────────────────────────────────────────────────────────────

const center: React.CSSProperties = {
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "column",
  padding: 120,
};

/** 1. Пятница, шесть вечера — и четыре окна. */
export const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  // «Поздравляю, вечер отменяется» — кадр гаснет и краснеет
  const doom = interpolate(frame, [sec(8.6), sec(9.6)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ ...center, justifyContent: "flex-start", paddingTop: 150 }}>
        <Kinetic words={["Пятница.", "Шесть", "вечера."]} from={0} size={104} step={5} />
      </AbsoluteFill>

      {/* Сообщение клиента */}
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 420,
          maxWidth: 760,
          padding: "26px 32px",
          borderRadius: "22px 22px 22px 6px",
          background: C.ink800,
          border: `1px solid ${C.ink700}`,
          ...rise(frame, sec(2.1), 16, 24),
        }}
      >
        <div style={{ ...text, fontSize: 26, color: C.ink500, marginBottom: 8 }}>клиент</div>
        <div style={{ ...text, fontSize: 40, fontWeight: 600, color: C.ink50 }}>
          «ну что там по размещению?»
        </div>
      </div>

      {/* Четыре окна валятся друг на друга */}
      <WindowCard title="Aspro" from={sec(4.6)} x={980} y={300} rotate={-4} />
      <WindowCard title="Таблица учёта.xlsx" from={sec(5.4)} x={1120} y={430} rotate={3} />
      <WindowCard title="Почта: 214 писем" from={sec(6.1)} x={900} y={560} rotate={-2} />
      <WindowCard title="Новая папка 3" from={sec(6.9)} x={1180} y={690} rotate={5} />

      <AbsoluteFill
        style={{
          background: `radial-gradient(90% 70% at 60% 55%, rgba(239,68,68,.18) 0%, rgba(0,0,0,.72) 75%)`,
          opacity: doom,
        }}
      />
      <AbsoluteFill style={{ ...center, opacity: doom }}>
        <div style={{ ...display, fontSize: 92, fontWeight: 700, color: C.ink50, textAlign: "center" }}>
          Вечер отменяется
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 2. Цена вопроса: три цифры. */
export const SceneCost: React.FC = () => {
  const frame = useCurrentFrame();
  const items: [React.ReactNode, string][] = [
    [<Counter key="a" from={0} to={4} start={sec(0.2)} dur={18} size={150} />, "окна"],
    [
      <span key="b" style={{ ...display, fontSize: 150, fontWeight: 700, color: C.brand }}>
        ½
      </span>,
      "рабочего дня",
    ],
    [<Counter key="c" from={0} to={10} start={sec(2.6)} dur={20} size={150} />, "секунд ответа"],
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ ...center, flexDirection: "row", gap: 150 }}>
        {items.map(([big, label], i) => (
          <div key={i} style={{ textAlign: "center", ...rise(frame, sec(0.1 + i * 1.2), 18, 30) }}>
            {big}
            <div style={{ ...text, fontSize: 34, color: C.ink300, marginTop: 10 }}>{label}</div>
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 3. Бренд. */
export const SceneBrand: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={center}>
        <XoMark size={210} from={0} />
        <div style={{ marginTop: 44, textAlign: "center", ...rise(frame, sec(0.5), 20, 26) }}>
          <div
            style={{
              ...display,
              fontSize: 118,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: C.ink50,
              lineHeight: 1,
            }}
          >
            COLIZEUM <span style={{ color: C.brand }}>AGENCY</span>
          </div>
        </div>
        <Sub from={sec(1.6)}>Рабочее место отдела рекламы. Вся работа — в одном месте.</Sub>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Линейка пяти стадий сделки. */
const StageRail: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame();
  const stages = ["Лид", "Договор", "Оплата", "Размещение", "Закрытие"];
  const stuck = 2; // «застряла» — на оплате
  const blink = Math.sin((frame - from) / 4) * 0.5 + 0.5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {stages.map((s, i) => {
        const on = frame > from + i * 7;
        const isStuck = i === stuck && frame > from + 34;
        return (
          <React.Fragment key={s}>
            <div
              style={{
                ...text,
                fontSize: 30,
                fontWeight: 700,
                padding: "18px 30px",
                borderRadius: 14,
                color: on ? (isStuck ? "#1F1F1F" : C.ink50) : C.ink500,
                background: isStuck
                  ? `rgba(252,223,59,${0.65 + blink * 0.35})`
                  : on
                    ? "rgba(31,31,31,.9)"
                    : "rgba(21,21,22,.7)",
                border: `1px solid ${on ? C.ink700 : "#1a1a1b"}`,
                transform: `scale(${on ? 1 : 0.95})`,
                transition: "none",
                opacity: on ? 1 : 0.5,
              }}
            >
              {s}
            </div>
            {i < stages.length - 1 && (
              <div
                style={{
                  width: 54,
                  height: 3,
                  background: frame > from + i * 7 + 4 ? C.brand : C.ink700,
                  opacity: frame > from + i * 7 + 4 ? 1 : 0.4,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** 4. Клиент и сделка. */
export const SceneClient: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const railFrom = sec(9.6);
  return (
    <AbsoluteFill>
      <Backdrop />
      {frame < sec(6.2) && (
        <>
          <Shot src="client-card" from={0} dur={sec(6.4)} zoom={1.05} />
          <Lower
            from={sec(0.4)}
            title="Карточка клиента"
            note="Реквизиты, контакты, документы, деньги — и вся история рядом"
          />
        </>
      )}
      {frame >= sec(6.2) && frame < railFrom && (
        <>
          <Shot src="client-timeline" from={sec(6.2)} dur={sec(3.6)} zoom={1.05} />
          <Lower from={sec(6.5)} title="Вся история клиента одной лентой" />
        </>
      )}
      {frame >= railFrom && (
        <AbsoluteFill style={{ ...center }}>
          <div style={{ ...rise(frame, railFrom, 16, 22) }}>
            <div
              style={{
                ...display,
                fontSize: 64,
                fontWeight: 700,
                color: C.ink50,
                textAlign: "center",
                marginBottom: 46,
              }}
            >
              Сделка идёт пятью шагами
            </div>
          </div>
          <StageRail from={railFrom + 10} />
          <div
            style={{
              ...text,
              fontSize: 34,
              color: C.brand,
              marginTop: 44,
              ...rise(frame, railFrom + sec(2.6), 16, 18),
            }}
          >
            …и сразу видно, на каком шаге она застряла
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** 5. Задачи: доска и недельная сверка. */
export const SceneTasks: React.FC = () => {
  const frame = useCurrentFrame();
  const swap = sec(5.1);
  return (
    <AbsoluteFill>
      <Backdrop />
      {frame < swap ? (
        <>
          <Shot src="tasks-board" from={0} dur={swap} zoom={1.05} />
          <Lower from={sec(0.3)} title="Доска: у кого сейчас мяч" note="Наша сторона или сторона клиента" />
        </>
      ) : (
        <>
          <Shot src="tasks-week" from={swap} dur={sec(5.4)} zoom={1.05} pan={60} />
          <Lower
            from={swap + 6}
            title="Недельная сверка по клиентам"
            note="Сделано · Делаем сейчас · Дальше по сроку"
          />
        </>
      )}
      <div style={{ position: "absolute", right: 96, top: 84, display: "flex", gap: 14 }}>
        <Chip label="Один список" from={sec(0.6)} />
        <Chip label="Два взгляда" from={sec(0.6)} i={1} />
      </div>
    </AbsoluteFill>
  );
};

/** 6. Деньги: НДС считается сам. */
export const SceneMoney: React.FC = () => {
  const frame = useCurrentFrame();
  const calcFrom = sec(3.2);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Shot src="finances" from={0} dur={sec(10.6)} zoom={1.06} />
      <AbsoluteFill style={{ ...center, justifyContent: "flex-start", paddingTop: 170 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
            padding: "34px 52px",
            borderRadius: 24,
            background: "rgba(16,16,17,.92)",
            border: `1px solid ${C.ink700}`,
            boxShadow: "0 30px 90px rgba(0,0,0,.6)",
            ...rise(frame, calcFrom, 18, 26),
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ ...text, fontSize: 24, color: C.ink500, marginBottom: 6 }}>вводите чистую</div>
            <div style={{ ...display, fontSize: 86, fontWeight: 700, color: C.ink50 }}>100 000 ₽</div>
          </div>
          <div style={{ ...display, fontSize: 70, color: C.brand }}>→</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ ...text, fontSize: 24, color: C.ink500, marginBottom: 6 }}>сервис добавит НДС 22 %</div>
            <div style={{ ...display, fontSize: 86, fontWeight: 700, color: C.brand }}>
              <Counter from={100000} to={122000} start={calcFrom + 14} dur={26} size={86} suffix=" ₽" />
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Lower
        from={sec(6.6)}
        title="План оплат — по месяцам"
        note="Раскладывается, пока остаток не ноль"
      />
    </AbsoluteFill>
  );
};

/** 7. Документы и маркировка. */
export const SceneDocs: React.FC = () => {
  const frame = useCurrentFrame();
  const ordFrom = sec(8.2);
  return (
    <AbsoluteFill>
      <Backdrop />
      {frame < ordFrom ? (
        <>
          <Shot
            src="documents"
            from={0}
            dur={ordFrom}
            zoom={1.05}
            focus={{ x: 0.3, y: 0.42, w: 0.3, h: 0.3, delay: sec(2.2) }}
          />
          <Lower
            from={sec(0.4)}
            title="Документ — просто перетащить"
            note="Версии не теряются: свежая всегда подписана"
          />
        </>
      ) : (
        <>
          <Shot src="ord" from={ordFrom} dur={sec(6.3)} zoom={1.05} />
          <Lower from={ordFrom + 6} title="ЕРИД и маркировка — отдельно" note="Со сроками, чтобы не вспоминать в последний день" />
        </>
      )}
    </AbsoluteFill>
  );
};

/** 8. Напарник ИИ. */
export const SceneAi: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <Shot src="assistant" from={0} dur={sec(8.5)} zoom={1.05} />
      <AbsoluteFill style={{ ...center, justifyContent: "flex-start", paddingTop: 190 }}>
        <div
          style={{
            ...text,
            fontSize: 40,
            fontWeight: 600,
            color: C.ink50,
            padding: "24px 34px",
            borderRadius: "22px 22px 6px 22px",
            background: "rgba(252,223,59,.14)",
            border: `1px solid rgba(252,223,59,.5)`,
            ...rise(frame, sec(1.4), 16, 20),
          }}
        >
          «Что горит по МТС на этой неделе?»
        </div>
        <div
          style={{
            ...text,
            fontSize: 34,
            color: C.ink300,
            marginTop: 22,
            padding: "22px 30px",
            borderRadius: "22px 22px 22px 6px",
            background: "rgba(16,16,17,.92)",
            border: `1px solid ${C.ink700}`,
            maxWidth: 1000,
            ...rise(frame, sec(3.4), 16, 20),
          }}
        >
          Смотрел: карточка клиента · задачи · база знаний
        </div>
      </AbsoluteFill>
      <Lower from={sec(5.6)} title="Кинули файл — разложит" note="Ответит словами, а не ссылкой на инструкцию" />
    </AbsoluteFill>
  );
};

/** 9. Всё под присмотром. */
export const SceneTrust: React.FC = () => {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Shot src="audit" from={0} dur={sec(8.1)} zoom={1.05} />
      <AbsoluteFill style={{ ...center, justifyContent: "flex-start", paddingTop: 200 }}>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
          {["Журнал действий", "Вход по коду", "Права по ролям", "Копии каждую ночь"].map((l, i) => (
            <Chip key={l} label={l} from={sec(1.2)} i={i} />
          ))}
        </div>
      </AbsoluteFill>
      <Lower from={sec(0.3)} title="Кто что открыл и поменял — видно" />
    </AbsoluteFill>
  );
};

/** 10. Финал. */
export const SceneCta: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={center}>
        <XoMark size={170} from={0} />
        <div
          style={{
            ...display,
            fontSize: 104,
            fontWeight: 700,
            color: C.ink50,
            marginTop: 36,
            letterSpacing: "0.02em",
            ...rise(frame, sec(0.4), 18, 24),
          }}
        >
          COLIZEUM <span style={{ color: C.brand }}>AGENCY</span>
        </div>
        <div
          style={{
            ...text,
            fontSize: 42,
            color: C.ink300,
            marginTop: 30,
            textAlign: "center",
            ...rise(frame, sec(1.4), 18, 22),
          }}
        >
          Следующий вопрос клиента займёт <span style={{ color: C.brand }}>десять секунд</span>.
        </div>
        <div
          style={{
            ...text,
            fontSize: 34,
            color: C.ink500,
            marginTop: 18,
            ...rise(frame, sec(3.4), 18, 18),
          }}
        >
          А пятница останется пятницей.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
