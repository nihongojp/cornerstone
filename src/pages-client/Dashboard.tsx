"use client";

// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Box, Typography, IconButton, CircularProgress, Divider } from "@mui/material";
import * as d3 from "d3";
import Bart from "../components/Menut";
import Link from "next/link";
import { LessonListItem } from "../lib/types/lessons";
import { getUpNextLesson, UpNextLesson } from "../lib/progress-client";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

type Lesson = {
  slug: string;
  title: string;
  version: string;
  flashcards: string[];
  prefecture: string;
  isActive?: boolean;
};

// ── Teardrop / map-pin SVG path ──────────────────────────────────────────────
// Tip sits at (0, 0). Circle centre is at (0, -16), radius 9.
// Drawn as two cubic béziers (sides) + one arc (dome).
const PIN_PATH = "M 0,0 C -4,-5 -9,-9 -9,-16 A 9,9 0 1,1 9,-16 C 9,-9 4,-5 0,0 Z";

// Inner dot of the pin (white hole inside the dome)
const PIN_DOT_CY = -16;
const PIN_DOT_R  = 3.5;

const Dashboard = ({ allLessons }: { allLessons: LessonListItem[] }) => {
  const gRef        = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const svgRef      = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [geoData, setGeoData]     = useState<any>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [selectedPrefectureCode, setSelectedPrefectureCode] = useState<string | null>(null);
  const [isZoomedIn, setIsZoomedIn]     = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 600 });
  const [popup, setPopup] = useState<{ x: number; y: number; name: string } | null>(null);

  const [prefLessons, setPrefLessons]   = useState<Lesson[]>([]);

  const [upNext, setUpNext]             = useState<UpNextLesson | null>(null);
  const [upNextLoading, setUpNextLoading] = useState(false);

  // ── Prefecture name → English code ─────────────────────────────────────────
  const PREF_NAME_TO_CODE = useMemo<Record<string, string>>(() => ({
    "北海道": "Hokkaido", "青森県": "Aomori", "岩手県": "Iwate",
    "宮城県": "Miyagi",   "秋田県": "Akita",   "山形県": "Yamagata",
    "福島県": "Fukushima","茨城県": "Ibaraki", "栃木県": "Tochigi",
    "群馬県": "Gunma",    "埼玉県": "Saitama", "千葉県": "Chiba",
    "東京都": "Tokyo",    "神奈川県":"Kanagawa","新潟県": "Niigata",
    "富山県": "Toyama",   "石川県": "Ishikawa","福井県": "Fukui",
    "山梨県": "Yamanashi","長野県": "Nagano",  "岐阜県": "Gifu",
    "静岡県": "Shizuoka", "愛知県": "Aichi",   "三重県": "Mie",
    "滋賀県": "Shiga",    "京都府": "Kyoto",   "大阪府": "Osaka",
    "兵庫県": "Hyogo",    "奈良県": "Nara",    "和歌山県":"Wakayama",
    "鳥取県": "Tottori",  "島根県": "Shimane", "岡山県": "Okayama",
    "広島県": "Hiroshima","山口県": "Yamaguchi","徳島県":"Tokushima",
    "香川県": "Kagawa",   "愛媛県": "Ehime",   "高知県": "Kochi",
    "福岡県": "Fukuoka",  "佐賀県": "Saga",    "長崎県": "Nagasaki",
    "熊本県": "Kumamoto", "大分県": "Oita",    "宮崎県": "Miyazaki",
    "鹿児島県":"Kagoshima","沖縄県": "Okinawa",
    // English passthrough
    Hokkaido:"Hokkaido", Aomori:"Aomori",   Iwate:"Iwate",
    Miyagi:"Miyagi",     Akita:"Akita",     Yamagata:"Yamagata",
    Fukushima:"Fukushima",Ibaraki:"Ibaraki",Tochigi:"Tochigi",
    Gunma:"Gunma",       Saitama:"Saitama", Chiba:"Chiba",
    Tokyo:"Tokyo",       Kanagawa:"Kanagawa",Niigata:"Niigata",
    Toyama:"Toyama",     Ishikawa:"Ishikawa",Fukui:"Fukui",
    Yamanashi:"Yamanashi",Nagano:"Nagano",  Gifu:"Gifu",
    Shizuoka:"Shizuoka", Aichi:"Aichi",     Mie:"Mie",
    Shiga:"Shiga",       Kyoto:"Kyoto",     Osaka:"Osaka",
    Hyogo:"Hyogo",       Nara:"Nara",       Wakayama:"Wakayama",
    Tottori:"Tottori",   Shimane:"Shimane", Okayama:"Okayama",
    Hiroshima:"Hiroshima",Yamaguchi:"Yamaguchi",Tokushima:"Tokushima",
    Kagawa:"Kagawa",     Ehime:"Ehime",     Kochi:"Kochi",
    Fukuoka:"Fukuoka",   Saga:"Saga",       Nagasaki:"Nagasaki",
    Kumamoto:"Kumamoto", Oita:"Oita",       Miyazaki:"Miyazaki",
    Kagoshima:"Kagoshima",Okinawa:"Okinawa",
  }), []);

  const normalizePrefecture = useCallback(
    (raw: string): string | null => {
      const s = (raw || "").trim();
      return s ? (PREF_NAME_TO_CODE[s] ?? null) : null;
    },
    [PREF_NAME_TO_CODE]
  );

  // ── Reset zoom to identity ───────────────────────────────────────────────────
  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition().duration(750)
      .call(zoomRef.current.transform as any, d3.zoomIdentity);
    setIsZoomedIn(false);
    setSelectedPrefectureCode(null);
    setPopup(null);
  }, []);

  // ── Measure map container via ResizeObserver ─────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setContainerSize({ width, height });
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) setContainerSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, []);

  // ── Load up-next lesson ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setUpNextLoading(true);
        const data = await getUpNextLesson();
        if (!cancelled) setUpNext(data);
      } catch (e) {
        console.error("[Dashboard] up-next failed:", e);
        if (!cancelled) setUpNext(null);
      } finally {
        if (!cancelled) setUpNextLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Load lessons for selected prefecture ─────────────────────────────────────
  // The whole lesson list arrives as a prop (there are only a handful), so
  // this filters in memory instead of making a request per prefecture click.
  useEffect(() => {
    if (!selectedPrefectureCode) { setPrefLessons([]); return; }
    setPrefLessons(allLessons.filter((l) => l.prefecture === selectedPrefectureCode));
  }, [selectedPrefectureCode, allLessons]);

  // ── Effect 1: one-time SVG + zoom setup, load GeoJSON ───────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const g   = svg.append("g");
    gRef.current = g;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => g.attr("transform", event.transform));
    zoomRef.current = zoom;
    svg.call(zoom as any);

    d3.json("/japan.geojson")
      .then((data: any) => { if (data?.features) setGeoData(data); })
      .catch((e) => console.error("[Dashboard] GeoJSON load failed:", e));

    return () => { g.remove(); };
  }, []);

  // ── Effect 2: draw/redraw map ────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !geoData) return;

    const svg = d3.select(svgRef.current);
    const g   = gRef.current;
    const { width, height } = containerSize;

    const projection = d3.geoMercator().fitExtent([[60, 30], [width - 20, height - 20]], geoData);
    const path = d3.geoPath().projection(projection);

    const getRawName = (d: any): string =>
      d?.properties?.nam_ja || d?.properties?.nam || "Unknown Prefecture";

    // ── Sea background rect — click to zoom out ─────────────────────────────
    g.selectAll("rect.sea-bg").remove();
    g.insert("rect", ":first-child")
      .attr("class", "sea-bg")
      .attr("x", -9999).attr("y", -9999)
      .attr("width", 99999).attr("height", 99999)
      .attr("fill", "transparent")
      .style("cursor", "default")
      .on("click", () => resetZoom());

    // ── Prefecture fill paths ───────────────────────────────────────────────
    g.selectAll<SVGPathElement, any>("path.pref-path")
      .data(geoData.features)
      .join((enter) => enter.append("path").attr("class", "pref-path"))
      .attr("d", path as any)
      .attr("fill", "#b4441d")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseover", function () {
        d3.select(this).attr("fill", "#d4673a").attr("stroke-width", 1);
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "#b4441d").attr("stroke-width", 0.5);
      })
      .on("click", function (event: MouseEvent, d: any) {
        event.stopPropagation();
        const [[x0, y0], [x1, y1]] = path.bounds(d);
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const scale = Math.max(
          1.5,
          Math.min(8, Math.min((width * 0.35) / (x1 - x0), (height * 0.35) / (y1 - y0)))
        );
        if (zoomRef.current) {
          svg.transition().duration(900).ease(d3.easeCubicInOut).call(
            zoomRef.current.transform as any,
            d3.zoomIdentity
              .translate(width / 2 - scale * cx, height / 2 - scale * cy)
              .scale(scale)
          );
        }
        setIsZoomedIn(true);
        const rawName = getRawName(d);
        const code = normalizePrefecture(rawName);
        setSelectedPrefectureCode(code);
        setPopup({ x: event.clientX, y: event.clientY, name: rawName });
      });

    // ── Black teardrop / map-pin markers ─────────────────────────────────────
    // Each marker is a <g> translated to the prefecture centroid.
    // The PIN_PATH tip is at local (0,0) = the centroid, dome extends upward.
    g.selectAll("g.pref-marker").remove();

    geoData.features.forEach((d: any) => {
      const centroid = projection(d3.geoCentroid(d));
      if (!centroid) return;
      const [mx, my] = centroid;

      const markerG = g.append("g")
        .attr("class", "pref-marker")
        .attr("transform", `translate(${mx},${my})`)
        .style("cursor", "pointer");

      // Drop shadow filter applied inline via a feDropShadow trick
      markerG.append("path")
        .attr("d", PIN_PATH)
        .attr("fill", "#1a1a1a")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.8)
        .attr("stroke-linejoin", "round")
        .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.45))");

      // White inner dot (gives the classic hollow-head pin look)
      markerG.append("circle")
        .attr("cx", 0)
        .attr("cy", PIN_DOT_CY)
        .attr("r",  PIN_DOT_R)
        .attr("fill", "#ffffff")
        .attr("opacity", 0.85);

      // Hover / click interactions on the group
      markerG
        .on("mouseover", function () {
          d3.select(this).select("path")
            .attr("fill", "#b4441d")
            .attr("stroke-width", 1);
          d3.select(this)
            .raise() // bring to front so the pin isn't clipped by neighbours
            .attr("transform", `translate(${mx},${my}) scale(1.35)`);
        })
        .on("mouseout", function () {
          d3.select(this).select("path")
            .attr("fill", "#1a1a1a")
            .attr("stroke-width", 0.8);
          d3.select(this)
            .attr("transform", `translate(${mx},${my}) scale(1)`);
        })
        .on("click", (event: MouseEvent) => {
          event.stopPropagation();
          const rawName = getRawName(d);
          const code = normalizePrefecture(rawName);
          setPopup({ x: event.clientX, y: event.clientY, name: rawName });
          setSelectedPrefectureCode(code);
        });
    });
  }, [geoData, containerSize, normalizePrefecture, resetZoom]);

  // ── Clamp popup to viewport edges ───────────────────────────────────────────
  const popupLeft   = popup ? Math.min(popup.x + 18, window.innerWidth  - 300) : 0;
  const popupTop    = popup ? Math.max(popup.y - 130, 80)                       : 0;

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        bgcolor: "#dee2e4",
      }}
    >
      {/* ── Header (natural height, never overlaps map) ───────────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        <Bart />
      </Box>

      {/* ── Map area fills every pixel below the header ───────────────────── */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* SVG map */}
        <svg
          ref={svgRef}
          style={{ display: "block", width: "100%", height: "100%" }}
          viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
          preserveAspectRatio="xMidYMid meet"
        />

        {/* ── Zoom-out hint ─────────────────────────────────────────────── */}
        <Box
          sx={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            bgcolor: "rgba(0,0,0,0.6)",
            color: "#fff",
            borderRadius: 999,
            px: 2.5,
            py: 0.85,
            fontSize: "0.76rem",
            fontWeight: 600,
            letterSpacing: "0.05em",
            pointerEvents: "none",
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
            transition: "opacity 0.4s, transform 0.4s",
            opacity: isZoomedIn ? 1 : 0,
            transform: isZoomedIn
              ? "translateX(-50%) translateY(0)"
              : "translateX(-50%) translateY(6px)",
          }}
        >
          ← Click the sea to zoom out
        </Box>

        {/* ── Prefecture lesson popup ───────────────────────────────────── */}
        {popup && (
          <Box
            sx={{
              position: "fixed",
              top: popupTop,
              left: popupLeft,
              zIndex: 1200,
              width: 270,
              borderRadius: "18px",
              overflow: "hidden",
              boxShadow: "0 24px 64px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.1)",
              bgcolor: "#fff",
              // Small pointer triangle pointing left toward the pin
              "&::before": {
                content: '""',
                position: "absolute",
                left: -8,
                top: 28,
                width: 0,
                height: 0,
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent",
                borderRight: "8px solid #1a1a1a",
              },
            }}
          >
            {/* Header band — dark, matches the pin colour */}
            <Box
              sx={{
                bgcolor: "#1a1a1a",
                px: 2.5,
                pt: 2,
                pb: 1.75,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Box>
                <Typography
                  sx={{
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "1rem",
                    lineHeight: 1.3,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {popup.name}
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.45)", fontSize: "0.72rem", mt: 0.25 }}>
                  Select a lesson to begin
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setPopup(null)}
                sx={{
                  mt: -0.5,
                  mr: -0.5,
                  color: "rgba(255,255,255,0.55)",
                  "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
                }}
              >
                <CloseRoundedIcon sx={{ fontSize: "1rem" }} />
              </IconButton>
            </Box>

            {/* Lessons list */}
            <Box sx={{ px: 0, py: 0.5, maxHeight: 260, overflowY: "auto" }}>
              {prefLessons.length > 0 ? (
                prefLessons.map((lesson, idx) => (
                  <React.Fragment key={lesson.slug}>
                    {idx > 0 && (
                      <Divider sx={{ mx: 2.5, borderColor: "rgba(0,0,0,0.05)" }} />
                    )}
                    <Box
                      component={Link}
                      href={`/lesson/${lesson.slug}`}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        textDecoration: "none",
                        color: "inherit",
                        px: 2.5,
                        py: 1.5,
                        transition: "background 0.15s",
                        "&:hover": {
                          bgcolor: "rgba(180,68,29,0.06)",
                          "& .arrow-icon": { opacity: 1, transform: "translateX(0)" },
                        },
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.3 }}>
                          {lesson.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {lesson.version}
                        </Typography>
                      </Box>
                      <ArrowForwardRoundedIcon
                        className="arrow-icon"
                        sx={{
                          fontSize: "1rem",
                          color: "#b4441d",
                          opacity: 0,
                          transform: "translateX(-4px)",
                          transition: "opacity 0.15s, transform 0.15s",
                          flexShrink: 0,
                          ml: 1,
                        }}
                      />
                    </Box>
                  </React.Fragment>
                ))
              ) : (
                <Box sx={{ px: 2.5, py: 2 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    No lessons available for this prefecture yet.
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* ── Up Next panel ─────────────────────────────────────────────────
            position: absolute within the map container.
            Since the container has overflow: hidden and doesn't scroll,
            this is visually equivalent to fixed — it never moves.          */}
        <Box
          sx={{
            position: "absolute",
            top: 16,
            right: 16,
            width: { xs: "56vw", sm: 210 },
            maxWidth: 230,
            borderRadius: "16px",
            bgcolor: "rgba(255,255,255,0.96)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid rgba(0,0,0,0.06)",
            backdropFilter: "blur(12px)",
            overflow: "hidden",
            zIndex: 10,
          }}
        >
          {/* Panel header strip */}
          <Box
            sx={{
              bgcolor: "#1a1a1a",
              px: 2,
              py: 1.25,
            }}
          >
            <Typography
              sx={{
                color: "rgba(255,255,255,0.9)",
                fontWeight: 800,
                fontSize: "0.68rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Up Next
            </Typography>
          </Box>

          {/* Panel body */}
          <Box sx={{ px: 2, py: 1.75 }}>
            {upNextLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={14} sx={{ color: "#b4441d" }} />
                <Typography variant="body2" color="text.secondary">Loading…</Typography>
              </Box>
            ) : !upNext ? (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                No saved lesson yet. Pick a prefecture to start!
              </Typography>
            ) : (
              <Box>
                <Typography
                  sx={{ fontWeight: 800, fontSize: "0.92rem", lineHeight: 1.35, color: "#1a1a1a" }}
                >
                  {upNext.title}
                  {upNext.version ? (
                    <Box component="span" sx={{ fontWeight: 400, color: "text.secondary", ml: 0.5 }}>
                      ({upNext.version})
                    </Box>
                  ) : null}
                </Typography>

                <Box sx={{ display: "flex", gap: 2, mt: 0.75 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1.3 }}>
                      Prefecture
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#1a1a1a" }}>
                      {upNext.prefecture || "—"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1.3 }}>
                      Progress
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#1a1a1a" }}>
                      Step {upNext.lastStep + 1}
                    </Typography>
                  </Box>
                </Box>

                <Box
                  component={Link}
                  href={`/lesson/${upNext.slug}`}
                  aria-label={`Resume ${upNext.title}`}
                  sx={{
                    mt: 1.75,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.75,
                    textDecoration: "none",
                    bgcolor: "#1a1a1a",
                    color: "#fff",
                    borderRadius: "10px",
                    py: 1.1,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    letterSpacing: "0.02em",
                    transition: "background 0.2s, transform 0.15s",
                    "&:hover": {
                      bgcolor: "#b4441d",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  <PlayArrowRoundedIcon sx={{ fontSize: "1.1rem" }} />
                  Resume
                </Box>
              </Box>
            )}
          </Box>
        </Box>

        {/* ── Practice panel ─────────────────────────────────────────────── */}
        

        {/* ── Stories panel ─────────────────────────────────────────────── */}
        <Box
          sx={{
            position: "absolute",
            left: 16,
            bottom: 16,
            width: { xs: "56vw", sm: 210 },
            maxWidth: 240,
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            zIndex: 10,
          }}
        >
          <Box sx={{ bgcolor: "rgba(140,156,171,0.97)", backdropFilter: "blur(12px)", p: 2.25 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", mb: 0.5, color: "#1a1a1a" }}>
              Stories
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.65)", lineHeight: 1.55 }}>
              Continue your journey through Japanese culture and stories.
            </Typography>
          </Box>
        </Box>

        {/* ── New Lessons panel ──────────────────────────────────────────── */}
        <Box
          component={Link}
          href="/newlesson/l1-v1"
          sx={{
            position: "absolute",
            right: 16,
            bottom: 16,
            width: { xs: "56vw", sm: 210 },
            maxWidth: 240,
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            zIndex: 10,
            textDecoration: "none",
            transition: "transform 0.2s, box-shadow 0.2s",
            "&:hover": { transform: "translateY(-2px)", boxShadow: "0 12px 36px rgba(0,0,0,0.2)" },
          }}
        >
          <Box sx={{ bgcolor: "rgba(180,61,32,0.92)", backdropFilter: "blur(12px)", p: 2.25 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", mb: 0.5, color: "#fff" }}>
              New Lessons ✨
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.55 }}>
              Lesson 1 — greetings, phrases, and more.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;