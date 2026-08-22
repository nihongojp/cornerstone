"use client";
import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  Chip,
  Stack,
  Tooltip,
  Link as MuiLink,
  Divider,
  Skeleton,
  Tabs,
  Tab,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LinkIcon from "@mui/icons-material/Link";
import Bart from "@/components/Menut";
import RichText from "@/components/richtext/RichText";
import { proseToPlainText } from "@/lib/content/prose";
import type { Resource } from "@/payload/payload-types";

/*
 * The generated Payload types, not a restatement of them.
 *
 * These were hand-written shapes that `lib/content/adapters.ts` mapped a
 * `Resource` document into — renaming `sourceId` to `id` and `itemId` to `id`
 * along the way. Phase 4b deleted the adapter, so the document arrives as it is
 * stored and the renames go with it. `description` is still rich text, and the
 * card renders it for real rather than flattening it: a description whose
 * formatting silently disappeared would be worse than having left the field a
 * textarea. The three-line clamp in `sx.cardDesc` clamps the rendered output.
 */
type ResourceCategory = Resource;
type ResourceItem = NonNullable<Resource["items"]>[number];

/** Payload models an absent link as null; every check here is for falsiness. */
const linkOf = (item: ResourceItem): string => item.url ?? "";

const openExternal = (url: string) => {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};

const fadeUp = (i: number) => ({
  opacity: 0,
  transform: "translateY(10px)",
  animation: "fadeUp 420ms ease forwards",
  animationDelay: `${Math.min(i * 45, 320)}ms`,
});

const Resources = ({ data }: { data: ResourceCategory[] }): React.ReactElement => {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"All" | string>("All");

  const [pressedId, setPressedId] = useState<string | null>(null);

  const sx = {
    page: {
      minHeight: "100vh",
      position: "relative" as const,
      background:
        "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.55), rgba(222,226,228,0.95))",
      color: "text.primary",
      pb: 7,
    },
    headerWrap: {
      maxWidth: 1100,
      mx: "auto",
      px: { xs: 2, sm: 3 },
      pt: 3.5,
    },
    titleRow: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 2,
      flexWrap: "wrap" as const,
    },
    title: {
      fontWeight: 800,
      letterSpacing: -0.6,
      lineHeight: 1.1,
    },
    subtitle: {
      color: "text.secondary",
      mt: 0.75,
      maxWidth: 720,
    },
    controls: {
      mt: 3,
      display: "grid",
      gridTemplateColumns: { xs: "1fr", sm: "1fr 220px" },
      gap: 1.5,
      alignItems: "center",
    },
    search: {
      bgcolor: "rgba(255,255,255,0.75)",
      backdropFilter: "blur(10px)",
      borderRadius: 2,
      boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
      "& .MuiOutlinedInput-root": {
        borderRadius: 2,
        "& fieldset": { borderColor: "rgba(0,0,0,0.10)" },
        "&:hover fieldset": { borderColor: "rgba(0,0,0,0.18)" },
        "&.Mui-focused fieldset": {
          borderColor: "rgba(0,0,0,0.28)",
          borderWidth: 1,
        },
      },
    },
    select: {
      bgcolor: "rgba(255,255,255,0.75)",
      backdropFilter: "blur(10px)",
      borderRadius: 2,
      boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: "rgba(0,0,0,0.10)",
      },
      "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: "rgba(0,0,0,0.18)",
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: "rgba(0,0,0,0.28)",
      },
    },
    tabsWrap: {
      mt: 1.75,
      bgcolor: "rgba(255,255,255,0.65)",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 2,
      backdropFilter: "blur(10px)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
      overflow: "hidden",
    },
    tabs: {
      px: 1,
      "& .MuiTabs-indicator": {
        height: 3,
        borderRadius: 999,
      },
      "& .MuiTab-root": {
        textTransform: "none" as const,
        fontWeight: 800,
        minHeight: 44,
        transition: "all 160ms ease",
        "&:hover": {
          backgroundColor: "rgba(0,0,0,0.04)",
        },
      },
    },
    contentWrap: {
      maxWidth: 1100,
      mx: "auto",
      px: { xs: 2, sm: 3 },
      mt: 3,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: {
        xs: "1fr",
        sm: "repeat(2, minmax(0, 1fr))",
        lg: "repeat(3, minmax(0, 1fr))",
      },
      gap: 2,
    },
    card: {
      textAlign: "left" as const,
      p: 2,
      borderRadius: 3,
      bgcolor: "rgba(255,255,255,0.72)",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
      transition:
        "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background-color 180ms ease",
      cursor: "pointer",
      position: "relative" as const,
      overflow: "hidden",
      "&:hover": {
        transform: "translateY(-3px)",
        boxShadow: "0 22px 60px rgba(0,0,0,0.12)",
        borderColor: "rgba(0,0,0,0.12)",
        bgcolor: "rgba(255,255,255,0.82)",
      },
      "&:active": { transform: "translateY(-1px) scale(0.99)" },
      "&:focus-within": {
        outline: "2px solid rgba(25,118,210,0.25)",
        outlineOffset: 2,
      },
    },
    cardDisabled: {
      cursor: "default",
      opacity: 0.72,
      "&:hover": {
        transform: "none",
        boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
        borderColor: "rgba(0,0,0,0.06)",
        bgcolor: "rgba(255,255,255,0.72)",
      },
    },
    cardTop: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 1.5,
    },
    cardTitle: {
      fontWeight: 800,
      letterSpacing: -0.2,
      lineHeight: 1.15,
    },
    cardDesc: {
      color: "text.secondary",
      mt: 0.75,
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical" as const,
      overflow: "hidden",
      minHeight: 60,
    },
    cardFooter: {
      mt: 1.5,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 1.5,
    },
    url: {
      display: "inline-flex",
      alignItems: "center",
      gap: 0.75,
      color: "text.secondary",
      fontSize: 12,
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    empty: {
      mt: 4,
      p: 3,
      borderRadius: 3,
      bgcolor: "rgba(255,255,255,0.65)",
      border: "1px dashed rgba(0,0,0,0.12)",
      textAlign: "center" as const,
    },
  };

  const categoryNames = useMemo(() => {
    const names = Array.from(new Set(data.map((d) => d.category))).sort();
    return ["All", ...names];
  }, [data]);

  // Tabs: value must map to cat. We'll use "All" + category names.
  const tabValue = useMemo(() => {
    const idx = categoryNames.indexOf(cat);
    return idx >= 0 ? idx : 0;
  }, [categoryNames, cat]);

  const filteredItems = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const sourceEntries =
      cat === "All" ? data : data.filter((d) => d.category === cat);

    // If All: show sections; if specific cat: show just that section's items list
    const sections = sourceEntries
      .map((section) => {
        const items = !ql
          ? section.items ?? []
          : (section.items ?? []).filter((it) => {
              const t = (it.title ?? "").toLowerCase();
              // Through the plain-text converter: `String(document)` is
              // "[object Object]", which matches the query "object" and nothing
              // else — search would have quietly stopped looking at descriptions.
              const d = proseToPlainText(it.description).toLowerCase();
              const u = (it.url ?? "").toLowerCase();
              return t.includes(ql) || d.includes(ql) || u.includes(ql);
            });
        return { ...section, items };
      })
      .filter((section) => (section.items?.length ?? 0) > 0);

    return sections;
  }, [q, cat, data]);

  const hasResults = filteredItems.length > 0;

  const totalVisible = useMemo(
    () => filteredItems.reduce((acc, s) => acc + (s.items?.length ?? 0), 0),
    [filteredItems]
  );

  return (
    <Box sx={sx.page}>
      <Box
        sx={{
          "@keyframes fadeUp": { to: { opacity: 1, transform: "translateY(0px)" } },
        }}
      />

      <Box sx={{ position: "absolute", top: 18, left: 18, zIndex: 10 }}>
        <Bart />
      </Box>

      <Box sx={sx.headerWrap}>
        <Box sx={sx.titleRow}>
          <Box>
            <Typography variant="h3" sx={sx.title}>
              Resources
            </Typography>
            <Typography variant="body1" sx={sx.subtitle}>
              Curated materials organized by category. Search by title, description, or URL.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={`${totalVisible} shown`}
              color="default"
              variant="filled"
              sx={{
                bgcolor: "rgba(255,255,255,0.65)",
                borderColor: "rgba(0,0,0,0.08)",
                fontWeight: 800,
              }}
            />
            {q.trim() ? (
              <Chip
                label={`Search: "${q.trim()}"`}
                onDelete={() => setQ("")}
                variant="outlined"
                sx={{ bgcolor: "rgba(255,255,255,0.6)", fontWeight: 700 }}
              />
            ) : null}
          </Stack>
        </Box>

        <Box sx={sx.controls}>
          <TextField
            fullWidth
            size="medium"
            placeholder="Search resources…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={sx.search}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: q ? (
                <InputAdornment position="end">
                  <Tooltip title="Clear search">
                    <IconButton
                      size="small"
                      aria-label="clear search"
                      onClick={() => setQ("")}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : null,
            }}
          />

          {/* Keep Select for power users / long list (optional). Tabs are primary. */}
          <Select
            size="medium"
            value={cat}
            onChange={(e) => setCat(String(e.target.value))}
            sx={sx.select}
            displayEmpty
          >
            {categoryNames.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </Box>

        {/* ✅ Subtabs below search */}
        <Box sx={sx.tabsWrap}>
          <Tabs
            value={tabValue}
            onChange={(_, newIdx) => {
              const next = categoryNames[newIdx] ?? "All";
              setCat(next);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={sx.tabs}
          >
            {categoryNames.map((name) => (
              <Tab key={name} label={name} />
            ))}
          </Tabs>
        </Box>

        <Divider sx={{ mt: 3, opacity: 0.35 }} />
      </Box>

      <Box sx={sx.contentWrap}>
        {hasResults ? (
          // If "All": show section headers; otherwise show just that section's grid
          <Box sx={{ mt: 1 }}>
            {cat === "All" ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredItems.map((section, sIdx) => (
                  <Box key={section.id} sx={{ ...fadeUp(sIdx) }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1.5, flexWrap: "wrap" }}>
                      <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -0.2 }}>
                        {section.category}
                      </Typography>
                      <Chip
                        label={`${section.items?.length ?? 0} items`}
                        variant="outlined"
                        sx={{
                          bgcolor: "rgba(255,255,255,0.6)",
                          borderColor: "rgba(0,0,0,0.10)",
                          fontWeight: 800,
                        }}
                      />
                    </Box>

                    <Box sx={sx.grid}>
                      {section.items.map((item, iIdx) => {
                        const disabled = !linkOf(item);
                        const isPressed = pressedId === item.itemId;

                        return (
                          <Box
                            key={item.itemId}
                            role={disabled ? "article" : "button"}
                            tabIndex={disabled ? -1 : 0}
                            aria-disabled={disabled}
                            onClick={() => {
                              if (disabled) return;
                              setPressedId(item.itemId);
                              window.setTimeout(() => setPressedId(null), 220);
                              openExternal(linkOf(item));
                            }}
                            onKeyDown={(e) => {
                              if (disabled) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setPressedId(item.itemId);
                                window.setTimeout(() => setPressedId(null), 220);
                                openExternal(linkOf(item));
                              }
                            }}
                            sx={{
                              ...sx.card,
                              ...(disabled ? sx.cardDisabled : {}),
                              ...(isPressed
                                ? {
                                    transform: "translateY(-1px) scale(0.992)",
                                    boxShadow: "0 18px 48px rgba(0,0,0,0.14)",
                                  }
                                : {}),
                              ...fadeUp(iIdx),
                            }}
                          >
                            <Box
                              sx={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 4,
                                background:
                                  "linear-gradient(90deg, rgba(0,0,0,0.18), rgba(0,0,0,0.04))",
                                opacity: disabled ? 0.25 : 0.45,
                              }}
                            />

                            <Box sx={sx.cardTop}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="h6" sx={sx.cardTitle}>
                                  {item.title}
                                </Typography>
                              </Box>

                              <Tooltip title={disabled ? "No link yet" : "Open in new tab"}>
                                <Box
                                  sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 2,
                                    display: "grid",
                                    placeItems: "center",
                                    bgcolor: disabled
                                      ? "rgba(0,0,0,0.06)"
                                      : "rgba(0,0,0,0.07)",
                                    border: "1px solid rgba(0,0,0,0.08)",
                                    transition:
                                      "transform 160ms ease, background-color 160ms ease",
                                    ...(disabled
                                      ? {}
                                      : {
                                          "&:hover": {
                                            transform: "scale(1.03)",
                                            bgcolor: "rgba(0,0,0,0.10)",
                                          },
                                        }),
                                  }}
                                >
                                  <OpenInNewIcon fontSize="small" />
                                </Box>
                              </Tooltip>
                            </Box>

                            <Box sx={{ ...sx.cardDesc, fontSize: "0.875rem" }}>
                              <RichText data={item.description} />
                            </Box>

                            <Box sx={sx.cardFooter}>
                              <Chip
                                size="small"
                                icon={<LinkIcon fontSize="small" />}
                                label={linkOf(item) ? "Link" : "No link"}
                                variant={linkOf(item) ? "filled" : "outlined"}
                                sx={{
                                  bgcolor: linkOf(item) ? "rgba(0,0,0,0.10)" : "transparent",
                                  borderColor: "rgba(0,0,0,0.12)",
                                  fontWeight: 800,
                                }}
                              />

                              {linkOf(item) ? (
                                <Tooltip title={linkOf(item)}>
                                  <MuiLink
                                    underline="hover"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openExternal(linkOf(item));
                                    }}
                                    href={linkOf(item)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={sx.url}
                                  >
                                    {linkOf(item)}
                                  </MuiLink>
                                </Tooltip>
                              ) : (
                                <Typography sx={sx.url}>(No URL)</Typography>
                              )}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              // Single category view: show only items (no headers)
              <Box sx={sx.grid}>
                {filteredItems[0]?.items?.map((item, iIdx) => {
                  const disabled = !linkOf(item);
                  const isPressed = pressedId === item.itemId;

                  return (
                    <Box
                      key={item.itemId}
                      role={disabled ? "article" : "button"}
                      tabIndex={disabled ? -1 : 0}
                      aria-disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        setPressedId(item.itemId);
                        window.setTimeout(() => setPressedId(null), 220);
                        openExternal(linkOf(item));
                      }}
                      onKeyDown={(e) => {
                        if (disabled) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setPressedId(item.itemId);
                          window.setTimeout(() => setPressedId(null), 220);
                          openExternal(linkOf(item));
                        }
                      }}
                      sx={{
                        ...sx.card,
                        ...(disabled ? sx.cardDisabled : {}),
                        ...(isPressed
                          ? {
                              transform: "translateY(-1px) scale(0.992)",
                              boxShadow: "0 18px 48px rgba(0,0,0,0.14)",
                            }
                          : {}),
                        ...fadeUp(iIdx),
                      }}
                    >
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 4,
                          background:
                            "linear-gradient(90deg, rgba(0,0,0,0.18), rgba(0,0,0,0.04))",
                          opacity: disabled ? 0.25 : 0.45,
                        }}
                      />

                      <Box sx={sx.cardTop}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="h6" sx={sx.cardTitle}>
                            {item.title}
                          </Typography>
                        </Box>

                        <Tooltip title={disabled ? "No link yet" : "Open in new tab"}>
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: 2,
                              display: "grid",
                              placeItems: "center",
                              bgcolor: disabled
                                ? "rgba(0,0,0,0.06)"
                                : "rgba(0,0,0,0.07)",
                              border: "1px solid rgba(0,0,0,0.08)",
                            }}
                          >
                            <OpenInNewIcon fontSize="small" />
                          </Box>
                        </Tooltip>
                      </Box>

                      <Box sx={{ ...sx.cardDesc, fontSize: "0.875rem" }}>
                        <RichText data={item.description} />
                      </Box>

                      <Box sx={sx.cardFooter}>
                        <Chip
                          size="small"
                          icon={<LinkIcon fontSize="small" />}
                          label={linkOf(item) ? "Link" : "No link"}
                          variant={linkOf(item) ? "filled" : "outlined"}
                          sx={{
                            bgcolor: linkOf(item) ? "rgba(0,0,0,0.10)" : "transparent",
                            borderColor: "rgba(0,0,0,0.12)",
                            fontWeight: 800,
                          }}
                        />

                        {linkOf(item) ? (
                          <Tooltip title={linkOf(item)}>
                            <MuiLink
                              underline="hover"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openExternal(linkOf(item));
                              }}
                              href={linkOf(item)}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={sx.url}
                            >
                              {linkOf(item)}
                            </MuiLink>
                          </Tooltip>
                        ) : (
                          <Typography sx={sx.url}>(No URL)</Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={sx.empty}>
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5 }}>
              No results
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try clearing the search or selecting a different category.
            </Typography>

            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
              <Chip
                label="Clear search"
                onClick={() => setQ("")}
                variant="outlined"
                sx={{ bgcolor: "rgba(255,255,255,0.65)", fontWeight: 700 }}
              />
              <Chip
                label="Show all categories"
                onClick={() => setCat("All")}
                variant="outlined"
                sx={{ bgcolor: "rgba(255,255,255,0.65)", fontWeight: 700 }}
              />
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Resources;
