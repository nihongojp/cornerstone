import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import { buildArrangement } from "../utils/dotMatchArrangement";

export type DotMatchPair = { hiragana: string; katakana: string; audio?: string };

function playAudio(src?: string) {
  if (!src) return;
  new Audio(src).play().catch(() => {});
}

type Connection = { dot1Id: string; dot2Id: string };

type DotMatchProps = {
  pairs: DotMatchPair[];
  onResult?: (r: { result: "correct" | "incorrect"; detail?: any }) => void;
  // Version 1 keeps the left column in the order the terms were introduced
  // instead of shuffling it along with the right column.
  keepLeftOrder?: boolean;
};

const DOT_SIZE = 14;

const DotMatch: React.FC<DotMatchProps> = ({ pairs, onResult, keepLeftOrder }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [firstId, setFirstId] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correctSet, setCorrectSet] = useState<Set<string>>(new Set());

  // Randomized once per mount so the layout is fresh on every attempt
  // (except the left column when keepLeftOrder is set — see buildArrangement).
  const [{ leftOrder, rightOrder }] = useState(() => buildArrangement(pairs.length, { keepLeftOrder }));

  const leftLabels = useMemo(() => leftOrder.map((pairId) => pairs[pairId].hiragana), [leftOrder, pairs]);
  const leftAudio = useMemo(() => leftOrder.map((pairId) => pairs[pairId].audio), [leftOrder, pairs]);
  const rightLabels = useMemo(() => rightOrder.map((pairId) => pairs[pairId].katakana), [rightOrder, pairs]);

  // Row index on the right column holding the correct katakana for each left row.
  const correctRightRowForLeftRow = useMemo(
    () => leftOrder.map((pairId) => rightOrder.indexOf(pairId)),
    [leftOrder, rightOrder]
  );
  // Row index on the left column holding the correct hiragana for each right row.
  const correctLeftRowForRightRow = useMemo(
    () => rightOrder.map((pairId) => leftOrder.indexOf(pairId)),
    [leftOrder, rightOrder]
  );

  const getLineColor = (dot1Id: string, dot2Id: string): string => {
    if (!submitted) return "#B43D20";
    const key = dot1Id.startsWith("L") ? `${dot1Id}-${dot2Id}` : `${dot2Id}-${dot1Id}`;
    return correctSet.has(key) ? "#059669" : "#DC2626";
  };

  const drawAllLines = (currentConnections: Connection[]) => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const containerRect = container.getBoundingClientRect();

    currentConnections.forEach(({ dot1Id, dot2Id }) => {
      const el1 = dotRefs.current[dot1Id];
      const el2 = dotRefs.current[dot2Id];
      if (!el1 || !el2) return;

      const r1 = el1.getBoundingClientRect();
      const r2 = el2.getBoundingClientRect();
      const x1 = r1.left - containerRect.left + r1.width / 2;
      const y1 = r1.top - containerRect.top + r1.height / 2;
      const x2 = r2.left - containerRect.left + r2.width / 2;
      const y2 = r2.top - containerRect.top + r2.height / 2;

      const color = getLineColor(dot1Id, dot2Id);

      // Glow/shadow line
      const shadow = document.createElementNS("http://www.w3.org/2000/svg", "line");
      shadow.setAttribute("x1", String(x1));
      shadow.setAttribute("y1", String(y1));
      shadow.setAttribute("x2", String(x2));
      shadow.setAttribute("y2", String(y2));
      shadow.setAttribute("stroke", color);
      shadow.setAttribute("stroke-width", "8");
      shadow.setAttribute("stroke-linecap", "round");
      shadow.setAttribute("opacity", "0.15");
      svg.appendChild(shadow);

      // Main line
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", "2.5");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("pointer-events", "stroke");
      line.style.cursor = submitted ? "default" : "pointer";

      if (!submitted) {
        line.addEventListener("click", () => {
          setConnections((prev) => {
            const next = prev.filter(
              (c) => !((c.dot1Id === dot1Id && c.dot2Id === dot2Id) || (c.dot1Id === dot2Id && c.dot2Id === dot1Id))
            );
            drawAllLines(next);
            return next;
          });
        });
      }
      svg.appendChild(line);
    });
  };

  useEffect(() => {
    drawAllLines(connections);
  }, [connections, submitted, correctSet]);

  useEffect(() => {
    const handler = () => drawAllLines(connections);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [connections, submitted, correctSet]);

  const isConnected = (id: string) => connections.some((c) => c.dot1Id === id || c.dot2Id === id);

  const handleDotClick = (id: string) => {
    if (submitted || isConnected(id)) return;

    if (!firstId) { setFirstId(id); return; }
    if (id === firstId) { setFirstId(null); return; }

    const firstIsLeft = firstId.startsWith("L");
    const thisIsLeft = id.startsWith("L");
    if (firstIsLeft === thisIsLeft) { setFirstId(null); return; }

    const leftId = firstIsLeft ? firstId : id;
    const rightId = firstIsLeft ? id : firstId;
    setConnections((prev) => [...prev, { dot1Id: leftId, dot2Id: rightId }]);
    setFirstId(null);
  };

  const canCheck = connections.length === leftLabels.length && leftLabels.length > 0;

  const handleCheck = () => {
    const made = new Set(connections.map((c) => `${c.dot1Id}-${c.dot2Id}`));
    const expected = new Set(
      correctRightRowForLeftRow.map((rightRow, leftRow) => `L${leftRow + 1}-R${rightRow + 1}`)
    );
    const allCorrect = expected.size === made.size && [...expected].every((k) => made.has(k));
    setCorrectSet(expected);
    setSubmitted(true);
    onResult?.({ result: allCorrect ? "correct" : "incorrect", detail: { made: [...made], expected: [...expected] } });
  };

  const handleReset = () => {
    setConnections([]);
    setFirstId(null);
    setSubmitted(false);
    setCorrectSet(new Set());
  };

  const CARD_SIZE = 72;
  const ROW_HEIGHT = 100;
  const containerHeight = pairs.length * ROW_HEIGHT;

  return (
    <Box sx={{ textAlign: "center", p: { xs: 0.5, sm: 1 }, width: "100%", overflowX: "hidden" }}>
      <Typography sx={{ fontWeight: 700, fontSize: { xs: "1rem", sm: "1.1rem" }, mb: 0.5, color: "#1C1917" }}>
        Match each hiragana to its katakana
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.25 }}>
        {submitted ? "Done! See your results above." : "Click a dot on the left, then one on the right to connect."}
      </Typography>

      <Box
        ref={containerRef}
        sx={{
          position: "relative",
          width: { xs: "100%", sm: 440 },
          maxWidth: 480,
          height: containerHeight,
          mx: "auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          overflow: "visible",
          px: { xs: 0, sm: 2 },
        }}
      >
        {/* SVG overlay */}
        <svg
          ref={svgRef}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1, overflow: "visible" }}
        />

        {/* Left column */}
        <Box sx={{ display: "flex", flexDirection: "column", zIndex: 2 }}>
          {leftLabels.map((label, i) => {
            const id = `L${i + 1}`;
            const active = firstId === id;
            const connected = isConnected(id);
            const expectedRId = `R${correctRightRowForLeftRow[i] + 1}`;
            const isCorrect = submitted && connections.some((c) => c.dot1Id === id && c.dot2Id === expectedRId);
            const isWrong = submitted && connected && !isCorrect;

            const audioSrc = leftAudio[i];

            return (
              <Box key={i} sx={{ height: ROW_HEIGHT, display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box
                  onClick={audioSrc ? () => playAudio(audioSrc) : undefined}
                  sx={{
                    position: "relative",
                    width: CARD_SIZE,
                    height: CARD_SIZE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: { xs: "1.5rem", sm: "1.8rem" },
                    fontWeight: 600,
                    borderRadius: "12px",
                    border: `2px solid ${isCorrect ? "#059669" : isWrong ? "#DC2626" : "rgba(0,0,0,0.1)"}`,
                    bgcolor: isCorrect ? "rgba(5,150,105,0.05)" : isWrong ? "rgba(220,38,38,0.05)" : "#FAFAFA",
                    transition: "border-color 0.3s, background-color 0.3s",
                    cursor: audioSrc ? "pointer" : "default",
                  }}
                >
                  {label}
                  {audioSrc && (
                    <VolumeUpRoundedIcon
                      sx={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        fontSize: "0.95rem",
                        color: "#B43D20",
                        opacity: 0.75,
                      }}
                    />
                  )}
                </Box>
                <Box
                  ref={(el) => { dotRefs.current[id] = el as HTMLDivElement | null; }}
                  onClick={() => handleDotClick(id)}
                  sx={{
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    borderRadius: "50%",
                    bgcolor: active ? "#B43D20" : connected ? (isCorrect ? "#059669" : isWrong ? "#DC2626" : "#B43D20") : "rgba(0,0,0,0.25)",
                    cursor: connected || submitted ? "default" : "pointer",
                    flexShrink: 0,
                    transition: "background-color 0.2s, transform 0.15s",
                    transform: active ? "scale(1.4)" : "scale(1)",
                    zIndex: 3,
                    boxShadow: active ? "0 0 0 4px rgba(180,61,32,0.2)" : "none",
                  }}
                />
              </Box>
            );
          })}
        </Box>

        {/* Right column */}
        <Box sx={{ display: "flex", flexDirection: "column", zIndex: 2 }}>
          {rightLabels.map((label, i) => {
            const id = `R${i + 1}`;
            const active = firstId === id;
            const connected = isConnected(id);
            // Find what L dot is connected to this R dot
            const connectedL = connections.find((c) => c.dot2Id === id)?.dot1Id;
            const expectedL = `L${correctLeftRowForRightRow[i] + 1}`;
            const isCorrect = submitted && connectedL === expectedL;
            const isWrong = submitted && connected && !isCorrect;

            return (
              <Box key={i} sx={{ height: ROW_HEIGHT, display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box
                  ref={(el) => { dotRefs.current[id] = el as HTMLDivElement | null; }}
                  onClick={() => handleDotClick(id)}
                  sx={{
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    borderRadius: "50%",
                    bgcolor: active ? "#B43D20" : connected ? (isCorrect ? "#059669" : isWrong ? "#DC2626" : "#B43D20") : "rgba(0,0,0,0.25)",
                    cursor: connected || submitted ? "default" : "pointer",
                    flexShrink: 0,
                    transition: "background-color 0.2s, transform 0.15s",
                    transform: active ? "scale(1.4)" : "scale(1)",
                    zIndex: 3,
                    boxShadow: active ? "0 0 0 4px rgba(180,61,32,0.2)" : "none",
                  }}
                />
                <Box
                  sx={{
                    width: CARD_SIZE,
                    height: CARD_SIZE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: { xs: "1.5rem", sm: "1.8rem" },
                    fontWeight: 600,
                    borderRadius: "12px",
                    border: `2px solid ${isCorrect ? "#059669" : isWrong ? "#DC2626" : "rgba(0,0,0,0.1)"}`,
                    bgcolor: isCorrect ? "rgba(5,150,105,0.05)" : isWrong ? "rgba(220,38,38,0.05)" : "#FAFAFA",
                    transition: "border-color 0.3s, background-color 0.3s",
                  }}
                >
                  {label}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Selection hint */}
      {firstId && !submitted && (
        <Typography variant="body2" sx={{ color: "#B43D20", fontWeight: 600, mt: 1.5 }}>
          {firstId} selected — click a dot on the other side
        </Typography>
      )}

      {/* Actions */}
      <Box sx={{ mt: 1.25, display: "flex", gap: 1.5, justifyContent: "center" }}>
        <Button
          variant="contained"
          disabled={!canCheck || submitted}
          onClick={handleCheck}
          sx={{ borderRadius: 999, fontWeight: 700, bgcolor: "#B43D20", "&:hover": { bgcolor: "#9D351C" }, px: 3 }}
        >
          Check
        </Button>
        <Button
          variant="outlined"
          onClick={handleReset}
          sx={{ borderRadius: 999, fontWeight: 700, borderColor: "rgba(0,0,0,0.15)", color: "text.secondary" }}
        >
          Reset
        </Button>
      </Box>
    </Box>
  );
};

export default DotMatch;