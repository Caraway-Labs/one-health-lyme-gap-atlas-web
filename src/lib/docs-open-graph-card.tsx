/**
 * Social card for documentation pages.
 * ImageResponse cannot read CSS variables, so these values repeat the Atlas
 * domain tokens --navy, --mint, and --teal from globals.css.
 */
const CARD_NAVY = "#082a4d";
const CARD_MINT = "#dff1eb";
const CARD_TEAL = "#0f7782";

export function DocsOpenGraphCard({
  markSrc,
  section,
  title,
}: {
  markSrc: string;
  section: string;
  title: string;
}) {
  return (
    <div
      style={{
        backgroundColor: CARD_NAVY,
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "72px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "24px",
        }}
      >
        {/* oxlint-disable-next-line next/no-img-element -- Satori social cards render a plain img, not next/image. */}
        <img alt="" height={72} src={markSrc} width={72} />
        <div
          style={{
            color: CARD_MINT,
            fontSize: 32,
            letterSpacing: "0.04em",
          }}
        >
          {section}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          fontSize: 68,
          lineHeight: 1.15,
          marginTop: "36px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          borderTop: `8px solid ${CARD_TEAL}`,
          color: CARD_MINT,
          display: "flex",
          fontSize: 32,
          paddingTop: "28px",
        }}
      >
        One Health Atlas documentation
      </div>
    </div>
  );
}
