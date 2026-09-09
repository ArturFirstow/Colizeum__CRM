import { AbsoluteFill, Sequence } from "remotion";
import { CountUp, Headline, Kicker, Note, StatCell } from "../components/Bits";
import { MUTED, PAD, RAIL, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

/** 16–24 с. Кто эта аудитория и почему реклама у нас окупается. */
export const Audience: React.FC = () => (
  <AbsoluteFill name="Аудитория">
    <Sequence name="Кто эти люди" from={0} durationInFrames={120}>
      <AbsoluteFill style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
        <div style={{ position: "absolute", top: 118, left: PAD }}>
          <Headline start={2} size={118} out={104}>
            Аудитория
          </Headline>
        </div>

        <div
          style={{
            position: "absolute",
            top: 300,
            left: PAD,
            right: RAIL + PAD,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            rowGap: 148,
            columnGap: 40,
          }}
        >
          <StatCell value={450000} caption="уникальных гостей" start={14} size={100} />
          <StatCell
            value={3500000}
            prefix="> "
            caption="часов игровых сессий в месяц"
            start={22}
            size={84}
          />
          <StatCell value={80000000} caption="человек знают бренд" start={30} size={100} />
          <StatCell
            value={250000}
            prefix="> "
            caption="подписчиков в соцсетях"
            start={38}
            size={84}
          />
        </div>

        <div style={{ position: "absolute", bottom: 74, left: PAD }}>
          <Note start={62} size={30}>
            95% мужчины · 76% моложе 25 лет · 85% приходят в клуб с друзьями
          </Note>
        </div>
      </AbsoluteFill>
    </Sequence>

    <Sequence name="Реклама работает" from={120} durationInFrames={120}>
      <AbsoluteFill style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
        <div style={{ position: "absolute", top: 112, left: PAD }}>
          <Kicker start={2}>Главное для рекламодателя</Kicker>
        </div>

        <div style={{ position: "absolute", top: 210, left: PAD }}>
          <CountUp to={50.8} start={10} dur={34} suffix=" %" size={250} />
          <div style={{ marginTop: 10, maxWidth: 1200 }}>
            <Headline start={40} size={72} color={WHITE}>
              гостей покупали товары брендов,
            </Headline>
            <Headline start={48} size={72} color={YELLOW}>
              чью рекламу видели в клубе
            </Headline>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 78,
            left: PAD,
            right: RAIL + PAD,
            display: "flex",
            gap: 72,
            alignItems: "flex-end",
          }}
        >
          {[
            ["73 %", "индекс лояльности NPS"],
            ["78,4 %", "ядро лояльной аудитории"],
            ["2–6 %", "CTR рекламного виджета"],
          ].map(([v, c]) => (
            <div key={c}>
              <div
                style={{
                  fontFamily: display.fontFamily,
                  fontSize: 66,
                  fontWeight: 700,
                  color: YELLOW,
                  lineHeight: 1,
                }}
              >
                {v}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: text.fontFamily,
                  fontSize: 25,
                  fontWeight: 300,
                  color: MUTED,
                }}
              >
                {c}
              </div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </Sequence>
  </AbsoluteFill>
);
