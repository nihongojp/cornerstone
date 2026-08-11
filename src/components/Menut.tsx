"use client";
// src/components/Menut.tsx (Bart)
import React, { useMemo, useState } from "react";
import { Typography } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";

type BartVariant = "fixed" | "embedded";

export type BartProps = {
  variant?: BartVariant;
  title?: string;
  className?: string;
};

const columnsData: string[][] = [
  ["Stories", "Gallery", "Resources", "Talk"],
  ["Fun Facts", "Games", "Watch"],
];

const menuImages: Record<string, string> = {
  Stories: "assets/Stories.png",
  Gallery: "assets/Gallery.png",
  Resources: "assets/Resources.png",
  Talk: "assets/Talk.png",
  "Fun Facts": "assets/Fun Facts.png",
  Games: "assets/Games.png",
  Watch: "assets/Watch.png",
};

const styles = {
  link: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
  } as React.CSSProperties,

  // ---------- EMBEDDED (under-map) ----------
  embeddedWrap: {
    width: "100%",
    borderRadius: 18,
    background: "#cfcfcf",
    border: "1px solid rgba(0,0,0,0.10)",
    boxShadow: "0 10px 26px rgba(0,0,0,0.12)",
    overflow: "hidden",
  } as React.CSSProperties,
  embeddedHeader: {
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55))",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  } as React.CSSProperties,
  embeddedTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: "#111",
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  embeddedHint: {
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(0,0,0,0.55)",
  } as React.CSSProperties,

  embeddedGrid: {
    padding: 16,
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 12,
  } as React.CSSProperties,

  embeddedCard: {
    background: "#cfcfcf",
    borderRadius: 16,
    padding: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
    transition: "transform 160ms ease, box-shadow 160ms ease",
  } as React.CSSProperties,

  embeddedCardActive: {
    outline: "3px solid rgba(180,68,29,0.25)",
    boxShadow: "0 10px 20px rgba(0,0,0,0.18)",
  } as React.CSSProperties,

  embeddedThumb: {
    width: "100%",
    height: "90px",
    borderRadius: 12,
    overflow: "hidden",
    background: "#cfcfcf",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
  } as React.CSSProperties,

  embeddedImg: {
    width: "100%",
    height: "auto",
    maxHeight: "90px",
    objectFit: "contain",
    display: "block",
  } as React.CSSProperties,

  embeddedLabel: {
    margin: 0,
    fontSize: 13,
    fontWeight: 900,
    color: "#111",
    lineHeight: 1.1,
  } as React.CSSProperties,

  // ---------- FIXED (slide-out sidebar) ----------
  fixedContainer: {
    position: "relative",
    zIndex: 10,
  } as React.CSSProperties,

  fixedOpen: {
    position: "fixed",
    top: "var(--app-header-height, 73px)",
    left: "30px",
    minWidth: "60px",
    height: "50px",
    cursor: "pointer",
    zIndex: 2100,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: "8px",
    padding: "0 10px",
    boxShadow: "0 0 5px rgba(0,0,0,0.3)",
  } as React.CSSProperties,

  fixedClose: {
    position: "absolute",
    top: "10px",
    right: "10px",
    width: "40px",
    height: "40px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: "8px",
  } as React.CSSProperties,

  fixedMenu: {
    backgroundColor: "#92a6ba",
    display: "flex",
    flexDirection: "row",
    width: "290px",
    height: "calc(100vh - var(--app-header-height, 73px))",
    transition: "transform 0.3s ease",
    position: "fixed",
    top: "var(--app-header-height, 73px)",
    left: 0,
    zIndex: 1500,
    paddingTop: "60px",
    boxShadow: "2px 0 10px rgba(0,0,0,0.2)",
    overflowY: "auto",
  } as React.CSSProperties,

  fixedMenuHidden: {
    transform: "translateX(-100%)",
  } as React.CSSProperties,

  fixedColumn: {
    width: "135px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
  } as React.CSSProperties,

  fixedCard: {
    marginTop: "8px",
    marginLeft: "18px",
    width: "110px",
    textAlign: "center",
    backgroundColor: "#cfcfcf",
    borderRadius: "12px",
    padding: "8px",
    boxSizing: "border-box",
    cursor: "pointer",
  } as React.CSSProperties,

  fixedImgWrap: {
    width: "100%",
    height: "110px",
    borderRadius: "10px",
    overflow: "hidden",
    backgroundColor: "#cfcfcf",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  fixedImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  } as React.CSSProperties,

  fixedTitle: {
    margin: "8px 0 0 0",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.2,
    color: "#111",
  } as React.CSSProperties,
};

const routeForTitle = (title: string) => {
  if (title === "Fun Facts") return "/funfacts";
  if (title === "Resources") return "/resources";
  if (title === "Stories") return "/stories";
  if (title === "Gallery") return "/gallery";
  if (title === "Games") return "/games";
  if (title === "Watch") return "/watch";
  if (title === "Talk") return "/talk";
  return "#";
};

const Bart: React.FC<BartProps> = ({ variant = "fixed", title = "Quick Menu", className }) => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const flatItems = useMemo(() => columnsData.flat(), []);

  const wrapIfLinked = (label: string, node: React.ReactNode, key: string) => {
    const to = routeForTitle(label);
    if (to === "#") return <React.Fragment key={key}>{node}</React.Fragment>;
    return (
      <Link href={to} key={key} style={styles.link}>
        {node}
      </Link>
    );
  };

  // ✅ Embedded mode (under the map)
  if (variant === "embedded") {
    return (
      <div style={styles.embeddedWrap} className={className}>
        <div style={styles.embeddedHeader}>
        <Typography sx={{fontWeight: 900, fontSize: 16, color: "#111", letterSpacing: "-0.01em",}}>
          {title}
        </Typography>
          <div style={styles.embeddedHint}>Pick a section</div>
        </div>

        <div
          style={{
            ...styles.embeddedGrid,
            // ✅ responsive without MUI: 2 cols small, 3/4 mid, 7 desktop
            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          {flatItems.map((label, idx) => {
            const to = routeForTitle(label);
            const active = to !== "#" && pathname === to;

            const card = (
              <div
                style={{
                  ...styles.embeddedCard,
                  ...(active ? styles.embeddedCardActive : {}),
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 24px rgba(0,0,0,0.16)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = styles.embeddedCard.boxShadow as string;
                }}
              >
                <div style={styles.embeddedThumb}>
                  <img src={menuImages[label]} alt={label} style={styles.embeddedImg} />
                </div>
                <h4 style={styles.embeddedLabel}>{label}</h4>
              </div>
            );

            return wrapIfLinked(label, card, `${label}-${idx}`);
          })}
        </div>
      </div>
    );
  }

  // ✅ Fixed slide-out mode (your current behavior)
  return (
    <div style={styles.fixedContainer} className={className}>
      {!open && (
        <div style={styles.fixedOpen} onClick={() => setOpen(true)}>
          <img
            src="https://www.svgrepo.com/show/344422/arrow-right-short.svg"
            alt="Open Menu"
            style={{ width: "30px", height: "30px" }}
          />
        </div>
      )}

      <div style={{ ...styles.fixedMenu, ...(open ? {} : styles.fixedMenuHidden) }}>
        <div style={styles.fixedClose} onClick={() => setOpen(false)}>
          <img
            src="https://cdn-icons-png.flaticon.com/512/109/109618.png"
            alt="Close"
            style={{ width: "30px", height: "30px" }}
          />
        </div>

        {columnsData.map((columnItems, colIndex) => (
          <div style={styles.fixedColumn} key={colIndex}>
            {columnItems.map((label, itemIndex) => {
              const card = (
                <div style={styles.fixedCard} key={`${colIndex}-${itemIndex}`}>
                  <div style={styles.fixedImgWrap}>
                    <img src={menuImages[label]} alt={label} style={styles.fixedImg} />
                  </div>
                  <h4 style={styles.fixedTitle}>{label}</h4>
                </div>
              );

              return wrapIfLinked(label, card, `${label}-${colIndex}-${itemIndex}`);
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Bart;
