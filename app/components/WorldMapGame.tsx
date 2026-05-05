"use client";

import * as CountryFlags from "country-flag-icons/react/3x2";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const GAME_DURATION_SEC = 30 * 60;
const MAP_CLICK_FN = "clickMapGameWorld";
const MAP_OVER_FN = "worldMapGameOver";
const MAP_OUT_FN = "worldMapGameOut";
const SCRIPT_SRC = "/svg-world-map/svg-world-map.js";
const HIGHLIGHT = "#475569";
const HOVER_HIGHLIGHT = "#64748b";
const GUESSED_HIGHLIGHT = "#16a34a";
const WRONG_HIGHLIGHT = "#dc2626";

const MIN_SCALE = 0.35;
const MAX_SCALE = 6;
const COUNTRY_FOCUS_SCALE = 2.8;
const SMALL_REGION_ARROW_THRESHOLD_PX = 40;
const WHEEL_ZOOM_SENS = 0.0015;
const PAN_THRESHOLD_PX = 6;
const DEBUG_MAP_FLOW = false;

type View = { x: number; y: number; scale: number };
type SuccessBurst = {
  id: number;
  mapX: number;
  mapY: number;
};
type RegionArrow = {
  x: number;
  y: number;
  label: string;
};
type GameOverReason = "time" | "win" | "surrender";
type RegionTargetId =
  | "all"
  | "AS"
  | "OC"
  | "AF"
  | "SA"
  | "NA"
  | "EU"
  | "central-america"
  | "nweu"
  | "east-asia"
  | "south-east-asia"
  | "south-asia"
  | "central-asia"
  | "west-asia"
  | "north-africa"
  | "west-africa"
  | "east-africa"
  | "southern-africa";

type RegionTarget = {
  id: RegionTargetId;
  label: string;
  shortLabel: string;
  region?: string;
  isos?: readonly string[];
};

const REGION_TARGETS: readonly RegionTarget[] = [
  { id: "all", label: "World", shortLabel: "World" },
  { id: "AS", label: "Asia", shortLabel: "Asia", region: "AS" },
  { id: "OC", label: "Oceania", shortLabel: "Oceania", region: "OC" },
  { id: "AF", label: "Africa", shortLabel: "Africa", region: "AF" },
  { id: "SA", label: "South America", shortLabel: "S. America", region: "SA" },
  { id: "NA", label: "North America", shortLabel: "N. America", region: "NA" },
  { id: "EU", label: "Europe", shortLabel: "Europe", region: "EU" },
  {
    id: "central-america",
    label: "Central America",
    shortLabel: "Central Am.",
    isos: ["BZ", "CR", "GT", "HN", "NI", "PA", "SV"],
  },
  {
    id: "nweu",
    label: "Northwest Europe",
    shortLabel: "NW Europe",
    isos: [
      "AT",
      "BE",
      "CH",
      "DE",
      "DK",
      "FI",
      "FR",
      "GB",
      "IE",
      "IS",
      "LI",
      "LU",
      "NL",
      "NO",
      "SE",
    ],
  },
  {
    id: "east-asia",
    label: "East Asia",
    shortLabel: "East Asia",
    isos: ["CN", "HK", "JP", "KP", "KR", "MN", "MO", "TW"],
  },
  {
    id: "south-east-asia",
    label: "Southeast Asia",
    shortLabel: "SE Asia",
    isos: ["BN", "ID", "KH", "LA", "MM", "MY", "PH", "SG", "TH", "TL", "VN"],
  },
  {
    id: "south-asia",
    label: "South Asia",
    shortLabel: "South Asia",
    isos: ["AF", "BD", "BT", "IN", "LK", "MV", "NP", "PK"],
  },
  {
    id: "central-asia",
    label: "Central Asia",
    shortLabel: "Central Asia",
    isos: ["KG", "KZ", "TJ", "TM", "UZ"],
  },
  {
    id: "west-asia",
    label: "West Asia",
    shortLabel: "West Asia",
    isos: [
      "AE",
      "AM",
      "AZ",
      "BH",
      "CY",
      "GE",
      "IL",
      "IQ",
      "IR",
      "JO",
      "KW",
      "LB",
      "OM",
      "PS",
      "QA",
      "SA",
      "SY",
      "TR",
      "YE",
    ],
  },
  {
    id: "north-africa",
    label: "North Africa",
    shortLabel: "N. Africa",
    isos: ["DZ", "EG", "EH", "LY", "MA", "SD", "TN"],
  },
  {
    id: "west-africa",
    label: "West Africa",
    shortLabel: "W. Africa",
    isos: [
      "BF",
      "BJ",
      "CI",
      "CV",
      "GH",
      "GM",
      "GN",
      "GW",
      "LR",
      "ML",
      "MR",
      "NE",
      "NG",
      "SH",
      "SL",
      "SN",
      "TG",
    ],
  },
  {
    id: "east-africa",
    label: "East Africa",
    shortLabel: "E. Africa",
    isos: [
      "BI",
      "DJ",
      "ER",
      "ET",
      "KE",
      "KM",
      "MG",
      "MU",
      "MW",
      "MZ",
      "RE",
      "RW",
      "SC",
      "SO",
      "SS",
      "TZ",
      "UG",
      "YT",
      "ZM",
      "ZW",
    ],
  },
  {
    id: "southern-africa",
    label: "Southern Africa",
    shortLabel: "S. Africa",
    isos: ["AO", "BW", "LS", "NA", "SZ", "ZA"],
  },
];

const REGION_TARGET_BY_ID = new Map(
  REGION_TARGETS.map((target) => [target.id, target]),
);

const REGION_THEME: Record<
  RegionTargetId,
  { dot: string; bar: string; chip: string; text: string }
> = {
  all: {
    dot: "bg-slate-500",
    bar: "from-slate-500 to-slate-700",
    chip: "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5",
    text: "text-slate-700 dark:text-slate-200",
  },
  AS: {
    dot: "bg-amber-500",
    bar: "from-amber-400 to-orange-500",
    chip: "border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10",
    text: "text-amber-800 dark:text-amber-200",
  },
  OC: {
    dot: "bg-cyan-500",
    bar: "from-cyan-400 to-sky-500",
    chip: "border-cyan-200 bg-cyan-50 dark:border-cyan-500/25 dark:bg-cyan-500/10",
    text: "text-cyan-800 dark:text-cyan-200",
  },
  AF: {
    dot: "bg-lime-500",
    bar: "from-lime-400 to-emerald-500",
    chip: "border-lime-200 bg-lime-50 dark:border-lime-500/25 dark:bg-lime-500/10",
    text: "text-lime-800 dark:text-lime-200",
  },
  SA: {
    dot: "bg-fuchsia-500",
    bar: "from-fuchsia-400 to-pink-500",
    chip: "border-fuchsia-200 bg-fuchsia-50 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10",
    text: "text-fuchsia-800 dark:text-fuchsia-200",
  },
  NA: {
    dot: "bg-blue-500",
    bar: "from-blue-400 to-indigo-500",
    chip: "border-blue-200 bg-blue-50 dark:border-blue-500/25 dark:bg-blue-500/10",
    text: "text-blue-800 dark:text-blue-200",
  },
  EU: {
    dot: "bg-violet-500",
    bar: "from-violet-400 to-purple-500",
    chip: "border-violet-200 bg-violet-50 dark:border-violet-500/25 dark:bg-violet-500/10",
    text: "text-violet-800 dark:text-violet-200",
  },
  "central-america": {
    dot: "bg-teal-500",
    bar: "from-teal-400 to-emerald-500",
    chip: "border-teal-200 bg-teal-50 dark:border-teal-500/25 dark:bg-teal-500/10",
    text: "text-teal-800 dark:text-teal-200",
  },
  nweu: {
    dot: "bg-indigo-500",
    bar: "from-indigo-400 to-sky-500",
    chip: "border-indigo-200 bg-indigo-50 dark:border-indigo-500/25 dark:bg-indigo-500/10",
    text: "text-indigo-800 dark:text-indigo-200",
  },
  "east-asia": {
    dot: "bg-red-500",
    bar: "from-red-400 to-rose-500",
    chip: "border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10",
    text: "text-red-800 dark:text-red-200",
  },
  "south-east-asia": {
    dot: "bg-orange-500",
    bar: "from-orange-400 to-amber-500",
    chip: "border-orange-200 bg-orange-50 dark:border-orange-500/25 dark:bg-orange-500/10",
    text: "text-orange-800 dark:text-orange-200",
  },
  "south-asia": {
    dot: "bg-yellow-500",
    bar: "from-yellow-400 to-amber-500",
    chip: "border-yellow-200 bg-yellow-50 dark:border-yellow-500/25 dark:bg-yellow-500/10",
    text: "text-yellow-800 dark:text-yellow-200",
  },
  "central-asia": {
    dot: "bg-stone-500",
    bar: "from-stone-400 to-yellow-600",
    chip: "border-stone-200 bg-stone-50 dark:border-stone-500/25 dark:bg-stone-500/10",
    text: "text-stone-800 dark:text-stone-200",
  },
  "west-asia": {
    dot: "bg-rose-500",
    bar: "from-rose-400 to-orange-500",
    chip: "border-rose-200 bg-rose-50 dark:border-rose-500/25 dark:bg-rose-500/10",
    text: "text-rose-800 dark:text-rose-200",
  },
  "north-africa": {
    dot: "bg-emerald-500",
    bar: "from-emerald-400 to-teal-500",
    chip: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10",
    text: "text-emerald-800 dark:text-emerald-200",
  },
  "west-africa": {
    dot: "bg-green-500",
    bar: "from-green-400 to-lime-500",
    chip: "border-green-200 bg-green-50 dark:border-green-500/25 dark:bg-green-500/10",
    text: "text-green-800 dark:text-green-200",
  },
  "east-africa": {
    dot: "bg-sky-500",
    bar: "from-sky-400 to-cyan-500",
    chip: "border-sky-200 bg-sky-50 dark:border-sky-500/25 dark:bg-sky-500/10",
    text: "text-sky-800 dark:text-sky-200",
  },
  "southern-africa": {
    dot: "bg-purple-500",
    bar: "from-purple-400 to-fuchsia-500",
    chip: "border-purple-200 bg-purple-50 dark:border-purple-500/25 dark:bg-purple-500/10",
    text: "text-purple-800 dark:text-purple-200",
  },
};

type SvgWorldMapApi = {
  worldMap: HTMLObjectElement;
  reset: (data?: unknown) => void;
  update: (data: Record<string, string>) => void;
  over: (id: string) => void;
  out: (id: string) => void;
  countryData: Record<string, { name: string; region?: string }>;
  countries: Record<string, Element>;
};

function debugMapFlow(label: string, data?: unknown): void {
  if (!DEBUG_MAP_FLOW) return;
  if (data === undefined) {
    console.debug(`[map-debug] ${label}`);
    return;
  }
  console.debug(`[map-debug] ${label}`, data);
}

function debugMapTable(label: string, rows: unknown[]): void {
  if (!DEBUG_MAP_FLOW) return;
  console.groupCollapsed(`[map-debug] ${label}`);
  console.table(rows);
  console.groupEnd();
}

declare global {
  interface Window {
    svgWorldMap?: (
      opts?: Record<string, unknown>,
      countryData?: unknown,
      timeData?: unknown,
    ) => Promise<SvgWorldMapApi>;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function resolveIsoFromClick(data: unknown): string | null {
  if (data == null || data === "") return null;
  if (typeof data !== "object") return null;
  const d = data as { id?: string; country?: { id?: string } };
  if (d.country?.id && /^[A-Z]{2}$/.test(d.country.id)) return d.country.id;
  if (d.id && /^[A-Z]{2}$/.test(d.id)) return d.id;
  if (d.id && /^[A-Z]{2}-/.test(d.id)) return d.id.slice(0, 2);
  return null;
}

function resolveIsoFromElement(element: Element | null): string | null {
  let current: Element | null = element;
  while (current) {
    const maybeCountry = current as Element & {
      country?: { id?: string };
      id?: string;
    };
    const countryId = maybeCountry.country?.id;
    if (countryId && /^[A-Z]{2}$/.test(countryId)) return countryId;
    if (maybeCountry.id && /^[A-Z]{2}$/.test(maybeCountry.id)) {
      return maybeCountry.id;
    }
    if (maybeCountry.id && /^[A-Z]{2}-/.test(maybeCountry.id)) {
      return maybeCountry.id.slice(0, 2);
    }
    current = current.parentElement;
  }
  return null;
}

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isCountryInTarget(
  iso: string,
  data: { region?: string } | undefined,
  targetId: RegionTargetId,
): boolean {
  const target = REGION_TARGET_BY_ID.get(targetId);
  if (!target || target.id === "all") return true;
  if (target.region) return data?.region === target.region;
  return target.isos?.includes(iso) ?? false;
}

function getTargetCountryIds(map: SvgWorldMapApi, targetId: RegionTargetId): string[] {
  const target = REGION_TARGET_BY_ID.get(targetId);
  if (target?.isos) {
    return target.isos.filter((iso) => map.countries[iso] != null);
  }

  return Object.keys(map.countryData).filter(
    (iso) =>
      map.countries[iso] != null &&
      iso.length === 2 &&
      isCountryInTarget(iso, map.countryData[iso], targetId),
  );
}

function getPlayableIds(
  map: SvgWorldMapApi,
  guessedIds: Set<string>,
  targetId: RegionTargetId,
): string[] {
  const targetIds = getTargetCountryIds(map, targetId);
  const playable = targetIds.filter((iso) => !guessedIds.has(iso));
  debugMapFlow("getPlayableIds", {
    targetId,
    targetIds,
    guessedIds: Array.from(guessedIds),
    playable,
  });
  return playable;
}

function getCountryRegionTarget(
  map: SvgWorldMapApi,
  iso: string,
): RegionTarget {
  const specificTarget = REGION_TARGETS.find(
    (target) => target.id !== "all" && target.isos?.includes(iso),
  );
  if (specificTarget) {
    debugMapFlow("getCountryRegionTarget:specific", {
      iso,
      country: map.countryData[iso]?.name ?? iso,
      target: specificTarget.id,
    });
    return specificTarget;
  }

  const broadTarget = REGION_TARGETS.find(
    (target) =>
      target.id !== "all" &&
      target.region != null &&
      target.region === map.countryData[iso]?.region,
  );
  const target = broadTarget ?? REGION_TARGETS[0];
  debugMapFlow("getCountryRegionTarget:broad", {
    iso,
    country: map.countryData[iso]?.name ?? iso,
    dataRegion: map.countryData[iso]?.region,
    target: target.id,
  });
  return target;
}

function getCountryBroadRegionTarget(
  map: SvgWorldMapApi,
  iso: string,
): RegionTarget {
  const broadTarget = REGION_TARGETS.find(
    (target) =>
      target.id !== "all" &&
      target.region != null &&
      target.region === map.countryData[iso]?.region,
  );
  const target = broadTarget ?? REGION_TARGETS[0];
  debugMapFlow("getCountryBroadRegionTarget", {
    iso,
    country: map.countryData[iso]?.name ?? iso,
    dataRegion: map.countryData[iso]?.region,
    target: target.id,
  });
  return target;
}

function getRegionProgress(
  map: SvgWorldMapApi | null,
  guessedIds: Set<string>,
) {
  if (!map) {
    return REGION_TARGETS.filter((target) => target.id !== "all").map(
      (target) => ({
        target,
        guessed: 0,
        total: 0,
        percent: 0,
      }),
    );
  }

  return REGION_TARGETS.filter((target) => target.id !== "all").map((target) => {
    const ids = getTargetCountryIds(map, target.id);
    const guessed = ids.filter((iso) => guessedIds.has(iso)).length;
    return {
      target,
      guessed,
      total: ids.length,
      percent: ids.length === 0 ? 0 : Math.round((guessed / ids.length) * 100),
    };
  });
}

function pickNextIso(ids: readonly string[], avoidIso?: string | null): string | null {
  if (ids.length === 0) return null;
  const candidates =
    avoidIso && ids.length > 1 ? ids.filter((iso) => iso !== avoidIso) : ids;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function getCountryCenter(country: Element | undefined): { x: number; y: number } | null {
  if (!country) return null;
  if ("getBBox" in country) {
    const box = (country as SVGGraphicsElement).getBBox();
    if (box.width > 0 || box.height > 0) {
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
  }

  const rect = country.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getCountryBounds(
  country: Element | undefined,
): { x: number; y: number; width: number; height: number } | null {
  if (!country) return null;
  if ("getBBox" in country) {
    const box = (country as SVGGraphicsElement).getBBox();
    if (box.width > 0 || box.height > 0) {
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }
  }

  const rect = country.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return null;
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function pickNearbyIso(
  map: SvgWorldMapApi,
  ids: readonly string[],
  fromIso: string | null,
): string | null {
  if (ids.length === 0) {
    debugMapFlow("pickNearbyIso:empty", { fromIso, ids });
    return null;
  }
  if (!fromIso) {
    const picked = pickNextIso(ids);
    debugMapFlow("pickNearbyIso:no-from", { ids, picked });
    return picked;
  }

  const fromCenter = getCountryCenter(map.countries[fromIso]);
  if (!fromCenter) {
    const picked = pickNextIso(ids, fromIso);
    debugMapFlow("pickNearbyIso:missing-from-center", {
      fromIso,
      fromName: map.countryData[fromIso]?.name ?? fromIso,
      ids,
      picked,
    });
    return picked;
  }

  let nearestIso: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const rows: {
    iso: string;
    name: string;
    hasSvg: boolean;
    hasCenter: boolean;
    distance: number | null;
  }[] = [];

  for (const iso of ids) {
    if (iso === fromIso) continue;
    const center = getCountryCenter(map.countries[iso]);
    const distance = center
      ? (center.x - fromCenter.x) ** 2 + (center.y - fromCenter.y) ** 2
      : null;
    rows.push({
      iso,
      name: map.countryData[iso]?.name ?? iso,
      hasSvg: map.countries[iso] != null,
      hasCenter: center != null,
      distance: distance == null ? null : Math.round(distance),
    });
    if (!center || distance == null) continue;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIso = iso;
    }
  }

  const fallback = pickNextIso(ids, fromIso);
  const picked = nearestIso ?? fallback;
  debugMapFlow("pickNearbyIso:result", {
    fromIso,
    fromName: map.countryData[fromIso]?.name ?? fromIso,
    fromCenter,
    ids,
    picked,
    pickedName: picked ? map.countryData[picked]?.name ?? picked : null,
    fallback,
  });
  debugMapTable(`nearby ranking from ${fromIso}`, rows);
  return picked;
}

function logNearbyPickCheck(
  map: SvgWorldMapApi,
  ids: readonly string[],
  fromIso: string | null,
  label: string,
): void {
  if (process.env.NODE_ENV === "production") return;

  const fromCenter = fromIso ? getCountryCenter(map.countries[fromIso]) : null;
  const rows = ids.map((iso) => {
    const center = getCountryCenter(map.countries[iso]);
    return {
      iso,
      name: map.countryData[iso]?.name ?? iso,
      hasSvg: map.countries[iso] != null,
      hasCenter: center != null,
      distance:
        fromCenter && center
          ? Math.round(
              (center.x - fromCenter.x) ** 2 + (center.y - fromCenter.y) ** 2,
            )
          : null,
    };
  });

  console.groupCollapsed(
    `[nearby-country-check] ${label}: from=${fromIso ?? "none"} candidates=${ids.length}`,
  );
  console.log({
    fromIso,
    fromName: fromIso ? map.countryData[fromIso]?.name ?? fromIso : null,
    fromHasSvg: fromIso ? map.countries[fromIso] != null : false,
    fromCenter,
    ids,
  });
  console.table(rows);
  console.groupEnd();
}

type SvgViewBox = { x: number; y: number; width: number; height: number };

function parseViewBox(value: string | null): SvgViewBox | null {
  if (!value) return null;
  const [x, y, width, height] = value.split(/\s+/).map(Number);
  if ([x, y, width, height].some((part) => Number.isNaN(part))) return null;
  return { x, y, width, height };
}

function getBaseViewBox(svgRoot: SVGSVGElement): SvgViewBox | null {
  const existing = svgRoot.dataset.baseViewBox;
  if (existing) return parseViewBox(existing);

  const initial = svgRoot.getAttribute("viewBox");
  if (!initial) return null;
  svgRoot.dataset.baseViewBox = initial;
  return parseViewBox(initial);
}

function getViewBoxForView(
  svgRoot: SVGSVGElement,
  objectEl: HTMLObjectElement,
  nextView: View,
): SvgViewBox | null {
  const base = getBaseViewBox(svgRoot);
  if (!base || objectEl.clientWidth <= 0 || objectEl.clientHeight <= 0) {
    return null;
  }

  return {
    x: base.x - (nextView.x * base.width) / (objectEl.clientWidth * nextView.scale),
    y: base.y - (nextView.y * base.height) / (objectEl.clientHeight * nextView.scale),
    width: base.width / nextView.scale,
    height: base.height / nextView.scale,
  };
}

function svgPointToViewport(
  svgRoot: SVGSVGElement,
  objectEl: HTMLObjectElement,
  viewport: HTMLElement,
  point: { x: number; y: number },
  nextView: View,
): { x: number; y: number } | null {
  const box = getViewBoxForView(svgRoot, objectEl, nextView);
  if (!box) return null;

  const viewportRect = viewport.getBoundingClientRect();
  const objectRect = objectEl.getBoundingClientRect();

  return {
    x:
      objectRect.left +
      ((point.x - box.x) / box.width) * objectRect.width -
      viewportRect.left,
    y:
      objectRect.top +
      ((point.y - box.y) / box.height) * objectRect.height -
      viewportRect.top,
  };
}

function svgPointToViewportBox(
  objectEl: HTMLObjectElement,
  viewport: HTMLElement,
  point: { x: number; y: number },
  box: SvgViewBox,
): { x: number; y: number } {
  const viewportRect = viewport.getBoundingClientRect();
  const objectRect = objectEl.getBoundingClientRect();

  return {
    x:
      objectRect.left +
      ((point.x - box.x) / box.width) * objectRect.width -
      viewportRect.left,
    y:
      objectRect.top +
      ((point.y - box.y) / box.height) * objectRect.height -
      viewportRect.top,
  };
}

function svgBoundsToViewport(
  svgRoot: SVGSVGElement,
  objectEl: HTMLObjectElement,
  viewport: HTMLElement,
  bounds: { x: number; y: number; width: number; height: number },
  nextView: View,
): { x: number; y: number; width: number; height: number } | null {
  const box = getViewBoxForView(svgRoot, objectEl, nextView);
  if (!box) return null;

  const viewportRect = viewport.getBoundingClientRect();
  const objectRect = objectEl.getBoundingClientRect();
  const left =
    objectRect.left +
    ((bounds.x - box.x) / box.width) * objectRect.width -
    viewportRect.left;
  const top =
    objectRect.top +
    ((bounds.y - box.y) / box.height) * objectRect.height -
    viewportRect.top;

  return {
    x: left,
    y: top,
    width: (bounds.width / box.width) * objectRect.width,
    height: (bounds.height / box.height) * objectRect.height,
  };
}

function getFitMapView(
  svgRoot: SVGSVGElement,
  objectEl: HTMLObjectElement,
): View | null {
  const base = getBaseViewBox(svgRoot);
  if (!base || objectEl.clientWidth <= 0 || objectEl.clientHeight <= 0) {
    return null;
  }

  const scale = Math.min(
    objectEl.clientWidth / base.width,
    objectEl.clientHeight / base.height,
  );
  const fittedWidth = base.width * scale;
  const fittedHeight = base.height * scale;

  return {
    x: (objectEl.clientWidth - fittedWidth) / 2,
    y: (objectEl.clientHeight - fittedHeight) / 2,
    scale,
  };
}

function getCenteredCountryView(
  svgRoot: SVGSVGElement,
  objectEl: HTMLObjectElement,
  countryCenter: { x: number; y: number },
  scale: number,
): View | null {
  const base = getBaseViewBox(svgRoot);
  if (!base || objectEl.clientWidth <= 0 || objectEl.clientHeight <= 0) {
    return null;
  }

  return {
    x:
      (base.x - (countryCenter.x - base.width / (2 * scale))) *
      objectEl.clientWidth *
      scale /
      base.width,
    y:
      (base.y - (countryCenter.y - base.height / (2 * scale))) *
      objectEl.clientHeight *
      scale /
      base.height,
    scale,
  };
}

function setSvgViewBox(svgRoot: SVGSVGElement, box: SvgViewBox): void {
  svgRoot.style.transform = "none";
  svgRoot.style.transition = "none";
  svgRoot.style.willChange = "auto";
  svgRoot.setAttribute(
    "viewBox",
    `${box.x} ${box.y} ${box.width} ${box.height}`,
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    tag === "BUTTON" ||
    target.isContentEditable
  );
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]/g, "");
}

function fuzzyIncludes(value: string, query: string): boolean {
  let queryIndex = 0;
  for (const char of value) {
    if (char === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function getSearchRank(name: string, iso: string, query: string): number | null {
  const normalizedName = normalizeSearchText(name);
  const normalizedIso = normalizeSearchText(iso);
  const compactName = compactSearchText(name);
  const compactQuery = compactSearchText(query);

  if (normalizedName === query || normalizedIso === query) return 0;
  if (
    normalizedName.startsWith(query) ||
    normalizedIso.startsWith(query) ||
    compactName.startsWith(compactQuery)
  ) return 1;

  const wordPrefix = normalizedName
    .split(/[\s()[\],.'-]+/)
    .some((word) => word.startsWith(query));
  if (wordPrefix) return 2;

  if (
    normalizedName.includes(query) ||
    normalizedIso.includes(query) ||
    compactName.includes(compactQuery)
  ) return 3;
  if (fuzzyIncludes(normalizedName, query) || fuzzyIncludes(compactName, compactQuery)) {
    return 4;
  }
  return null;
}

type PanSession = {
  pointerId: number;
  button: number;
  startClientX: number;
  startClientY: number;
  startVx: number;
  startVy: number;
  isPanning: boolean;
};

export function WorldMapGame() {
  const mapRef = useRef<SvgWorldMapApi | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const transformLayerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const guessedRef = useRef<Set<string>>(new Set());
  const wrongIdsRef = useRef<Set<string>>(new Set());
  const panSessionRef = useRef<PanSession | null>(null);
  const suppressClickRef = useRef(false);
  const hoveredIsoRef = useRef<string | null>(null);
  const viewBoxAnimationRef = useRef<number | null>(null);
  const viewAnimationTimeoutRef = useRef<number | null>(null);
  const selectCountryTargetRef = useRef<(iso: string) => void>(() => {});
  const gameStateRef = useRef({
    playing: false,
    ended: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [penalties, setPenalties] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC);
  const [gameOverReason, setGameOverReason] = useState<GameOverReason | null>(null);
  const [guessed, setGuessed] = useState<Set<string>>(() => new Set());
  const [mapApi, setMapApi] = useState<SvgWorldMapApi | null>(null);
  const [clickedIso, setClickedIso] = useState<string | null>(null);
  const [guessIso, setGuessIso] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isViewAnimating, setIsViewAnimating] = useState(false);
  const [successBurst, setSuccessBurst] = useState<SuccessBurst | null>(null);
  const [regionArrow, setRegionArrow] = useState<RegionArrow | null>(null);
  const viewRef = useRef<View>(view);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    guessedRef.current = guessed;
  }, [guessed]);

  const stopViewAnimation = useCallback(() => {
    if (viewBoxAnimationRef.current != null) {
      cancelAnimationFrame(viewBoxAnimationRef.current);
      viewBoxAnimationRef.current = null;
    }
    if (viewAnimationTimeoutRef.current != null) {
      window.clearTimeout(viewAnimationTimeoutRef.current);
      viewAnimationTimeoutRef.current = null;
    }
    setIsViewAnimating(false);
  }, []);

  const startViewAnimation = useCallback(() => {
    if (viewAnimationTimeoutRef.current != null) {
      window.clearTimeout(viewAnimationTimeoutRef.current);
    }
    setIsViewAnimating(true);
    viewAnimationTimeoutRef.current = window.setTimeout(() => {
      setIsViewAnimating(false);
      viewAnimationTimeoutRef.current = null;
    }, 760);
  }, []);

  useEffect(() => {
    return () => {
      if (viewBoxAnimationRef.current != null) {
        cancelAnimationFrame(viewBoxAnimationRef.current);
      }
      if (viewAnimationTimeoutRef.current != null) {
        window.clearTimeout(viewAnimationTimeoutRef.current);
      }
    };
  }, []);

  const playableIds = useMemo(() => {
    const m = mapApi;
    if (!m) return [] as string[];
    return getPlayableIds(m, guessed, "all");
  }, [guessed, mapApi]);

  const filteredOptions = useMemo(() => {
    const m = mapApi;
    if (!m) return [] as { iso: string; name: string }[];
    const q = search.trim().toLowerCase();
    const rows = playableIds.map((iso) => ({
      iso,
      name: m.countryData[iso]?.name ?? iso,
    }));
    rows.sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return rows;
    return rows
      .map((row) => ({
        ...row,
        rank: getSearchRank(row.name, row.iso, q),
      }))
      .filter((row): row is { iso: string; name: string; rank: number } => row.rank != null)
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
      .map(({ iso, name }) => ({ iso, name }));
  }, [playableIds, search, mapApi]);

  const paintMapState = useCallback((selectedIso: string | null) => {
    const map = mapRef.current;
    if (!map) return;
    map.reset();
    const updates: Record<string, string> = {};
    guessedRef.current.forEach((iso) => {
      updates[iso] = GUESSED_HIGHLIGHT;
    });
    wrongIdsRef.current.forEach((iso) => {
      if (!guessedRef.current.has(iso)) {
        updates[iso] = WRONG_HIGHLIGHT;
      }
    });
    const hoverIso = hoveredIsoRef.current;
    if (hoverIso && hoverIso !== selectedIso && !guessedRef.current.has(hoverIso)) {
      updates[hoverIso] = HOVER_HIGHLIGHT;
    }
    if (selectedIso) {
      updates[selectedIso] = HIGHLIGHT;
    }
    if (
      selectedIso &&
      wrongIdsRef.current.has(selectedIso) &&
      !guessedRef.current.has(selectedIso)
    ) {
      updates[selectedIso] = WRONG_HIGHLIGHT;
    }
    if (Object.keys(updates).length > 0) {
      map.update(updates);
    }
  }, []);

  const syncMapHighlight = useCallback(
    (hoverIso: string | null = hoveredIsoRef.current) => {
      hoveredIsoRef.current = hoverIso;
      paintMapState(clickedIso);
    },
    [clickedIso, paintMapState],
  );

  useEffect(() => {
    paintMapState(clickedIso);
  }, [clickedIso, guessed, paintMapState]);

  const selectedCountryDebug = useMemo(() => {
    if (!clickedIso || !mapApi) return null;
    const region = getCountryRegionTarget(mapApi, clickedIso);
    const broadRegion = getCountryBroadRegionTarget(mapApi, clickedIso);
    return {
      iso: clickedIso,
      name: mapApi.countryData[clickedIso]?.name ?? clickedIso,
      region: region.id,
      regionLabel: region.label,
      broadRegion: broadRegion.id,
      broadRegionLabel: broadRegion.label,
      guessed: guessed.has(clickedIso),
    };
  }, [clickedIso, guessed, mapApi]);

  useEffect(() => {
    debugMapFlow("selected-country", selectedCountryDebug ?? { iso: null });
  }, [selectedCountryDebug]);

  const endGame = useCallback((reason: GameOverReason) => {
    gameStateRef.current.playing = false;
    gameStateRef.current.ended = true;
    setGameOverReason(reason);
    setClickedIso(null);
    setRegionArrow(null);
    wrongIdsRef.current.clear();
    hoveredIsoRef.current = null;
    paintMapState(null);
  }, [paintMapState]);

  const centerCountry = useCallback((iso: string) => {
    const map = mapRef.current;
    const country = map?.countries[iso];
    const objectEl = map?.worldMap;
    const svgRoot = objectEl?.contentDocument?.documentElement as
      | SVGSVGElement
      | undefined;
    if (!country || !objectEl || !svgRoot) return;

    const countryCenter = getCountryCenter(country);
    const nextView = countryCenter
      ? getCenteredCountryView(
          svgRoot,
          objectEl,
          countryCenter,
          Math.max(viewRef.current.scale, COUNTRY_FOCUS_SCALE),
        )
      : null;
    if (!countryCenter || !nextView) {
      debugMapFlow("centerCountry:missing-geometry", {
        iso,
        hasCountry: country != null,
        hasObject: objectEl != null,
        hasSvgRoot: svgRoot != null,
        countryCenter,
        objectWidth: objectEl.clientWidth,
        objectHeight: objectEl.clientHeight,
      });
      return;
    }

    startViewAnimation();
    setView(nextView);
  }, [startViewAnimation]);

  const getCountryViewportCenter = useCallback((iso: string) => {
    const viewport = viewportRef.current;
    const map = mapRef.current;
    const country = map?.countries[iso];
    const objectEl = map?.worldMap;
    const svgRoot = objectEl?.contentDocument?.documentElement as
      | SVGSVGElement
      | undefined;
    if (!viewport || !country || !objectEl || !svgRoot) return null;

    const viewportRect = viewport.getBoundingClientRect();
    const objectRect = objectEl.getBoundingClientRect();
    const countryCenter = getCountryCenter(country);
    const currentBox = parseViewBox(svgRoot.getAttribute("viewBox"));
    if (!countryCenter || !currentBox) return null;

    return {
      x:
        objectRect.left +
        ((countryCenter.x - currentBox.x) / currentBox.width) *
          objectRect.width -
        viewportRect.left,
      y:
        objectRect.top +
        ((countryCenter.y - currentBox.y) / currentBox.height) *
          objectRect.height -
        viewportRect.top,
    };
  }, []);

  const getCountryViewportBounds = useCallback((iso: string, nextView = viewRef.current) => {
    const viewport = viewportRef.current;
    const map = mapRef.current;
    const country = map?.countries[iso];
    const objectEl = map?.worldMap;
    const svgRoot = objectEl?.contentDocument?.documentElement as
      | SVGSVGElement
      | undefined;
    if (!viewport || !country || !objectEl || !svgRoot) return null;

    const countryBounds = getCountryBounds(country);
    if (!countryBounds) return null;
    return svgBoundsToViewport(svgRoot, objectEl, viewport, countryBounds, nextView);
  }, []);

  const getCountryViewportCenterForView = useCallback(
    (iso: string, nextView = viewRef.current) => {
      const viewport = viewportRef.current;
      const map = mapRef.current;
      const country = map?.countries[iso];
      const objectEl = map?.worldMap;
      const svgRoot = objectEl?.contentDocument?.documentElement as
        | SVGSVGElement
        | undefined;
      if (!viewport || !country || !objectEl || !svgRoot) return null;

      const countryCenter = getCountryCenter(country);
      if (!countryCenter) return null;
      return svgPointToViewport(svgRoot, objectEl, viewport, countryCenter, nextView);
    },
    [],
  );

  const getCountryViewportCenterForCurrentBox = useCallback((iso: string) => {
    const viewport = viewportRef.current;
    const map = mapRef.current;
    const country = map?.countries[iso];
    const objectEl = map?.worldMap;
    const svgRoot = objectEl?.contentDocument?.documentElement as
      | SVGSVGElement
      | undefined;
    if (!viewport || !country || !objectEl || !svgRoot) return null;

    const countryCenter = getCountryCenter(country);
    const currentBox = parseViewBox(svgRoot.getAttribute("viewBox"));
    if (!countryCenter || !currentBox) return null;
    return svgPointToViewportBox(objectEl, viewport, countryCenter, currentBox);
  }, []);

  const showSuccessBurst = useCallback(
    (iso: string) => {
      const center = getCountryViewportCenter(iso);
      const id = Date.now();
      setSuccessBurst({
        id,
        mapX: center?.x ?? 0,
        mapY: center?.y ?? 0,
      });
      window.setTimeout(() => {
        setSuccessBurst((current) => (current?.id === id ? null : current));
      }, 900);
    },
    [getCountryViewportCenter],
  );

  const updateRegionArrow = useCallback(() => {
    if (!clickedIso || !mapApi || guessed.has(clickedIso)) {
      setRegionArrow(null);
      return;
    }

    const nextView = viewRef.current;
    const bounds = getCountryViewportBounds(clickedIso, nextView);
    const center = isViewAnimating
      ? getCountryViewportCenterForCurrentBox(clickedIso)
      : getCountryViewportCenterForView(clickedIso, nextView);
    if (
      !bounds ||
      !center ||
      Math.max(bounds.width, bounds.height) >= SMALL_REGION_ARROW_THRESHOLD_PX
    ) {
      setRegionArrow(null);
      return;
    }

    setRegionArrow({
      x: center.x,
      y: center.y,
      label: mapApi.countryData[clickedIso]?.name ?? clickedIso,
    });
  }, [
    clickedIso,
    getCountryViewportBounds,
    getCountryViewportCenterForCurrentBox,
    getCountryViewportCenterForView,
    guessed,
    isViewAnimating,
    mapApi,
  ]);

  useEffect(() => {
    if (!isViewAnimating) {
      queueMicrotask(updateRegionArrow);
      return;
    }

    let animationFrame = 0;
    const tick = () => {
      updateRegionArrow();
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [isViewAnimating, updateRegionArrow, view]);

  const selectCountryTarget = useCallback(
    (iso: string) => {
      debugMapFlow("selectCountryTarget", {
        iso,
        name: mapRef.current?.countryData[iso]?.name ?? iso,
        previous: clickedIso,
        previousName: clickedIso
          ? mapRef.current?.countryData[clickedIso]?.name ?? clickedIso
          : null,
      });
      setClickedIso(iso);
      setGuessIso(null);
      setSearch("");
      hoveredIsoRef.current = null;
      paintMapState(iso);
      requestAnimationFrame(() => centerCountry(iso));
    },
    [centerCountry, clickedIso, paintMapState],
  );

  useEffect(() => {
    selectCountryTargetRef.current = selectCountryTarget;
  }, [selectCountryTarget]);

  const restart = useCallback(() => {
    gameStateRef.current = { playing: true, ended: false };
    guessedRef.current = new Set();
    setPenalties(0);
    setScore(0);
    setTimeLeft(GAME_DURATION_SEC);
    setGameOverReason(null);
    setGuessed(new Set());
    setClickedIso(null);
    setGuessIso(null);
    setSearch("");
    setFeedback(null);
    stopViewAnimation();
    setView({ x: 0, y: 0, scale: 1 });
    wrongIdsRef.current.clear();
    hoveredIsoRef.current = null;
    paintMapState(null);
  }, [paintMapState, stopViewAnimation]);

  const surrender = useCallback(() => {
    if (loading || gameOverReason != null) return;
    endGame("surrender");
  }, [endGame, gameOverReason, loading]);

  const submitGuess = useCallback((submittedIso = guessIso) => {
    const map = mapRef.current;
    if (gameStateRef.current.ended || !map) return;
    if (!clickedIso || !submittedIso) return;

    debugMapFlow("submitGuess:start", {
      clickedIso,
      clickedName: map.countryData[clickedIso]?.name ?? clickedIso,
      submittedIso,
      submittedName: map.countryData[submittedIso]?.name ?? submittedIso,
      correct: clickedIso === submittedIso,
      guessed: Array.from(guessedRef.current),
    });

    if (clickedIso === submittedIso) {
      const nextGuessed = new Set(guessedRef.current);
      nextGuessed.add(clickedIso);
      guessedRef.current = nextGuessed;
      const currentRegion = getCountryRegionTarget(map, clickedIso);
      const broadRegion = getCountryBroadRegionTarget(map, clickedIso);
      const regionPlayableIds = getPlayableIds(map, nextGuessed, currentRegion.id);
      const broadRegionPlayableIds =
        broadRegion.id === currentRegion.id
          ? []
          : getPlayableIds(map, nextGuessed, broadRegion.id);
      const fallbackPlayableIds = getPlayableIds(map, nextGuessed, "all");
      const nextTarget =
        regionPlayableIds.length > 0
          ? pickNearbyIso(map, regionPlayableIds, clickedIso)
          : broadRegionPlayableIds.length > 0
            ? pickNearbyIso(map, broadRegionPlayableIds, clickedIso)
            : pickNearbyIso(map, fallbackPlayableIds, clickedIso);

      debugMapFlow("submitGuess:next-target-decision", {
        from: clickedIso,
        fromName: map.countryData[clickedIso]?.name ?? clickedIso,
        currentRegion: currentRegion.id,
        broadRegion: broadRegion.id,
        usedBucket:
          regionPlayableIds.length > 0
            ? "specific"
            : broadRegionPlayableIds.length > 0
              ? "broad"
              : "world",
        regionPlayableIds,
        broadRegionPlayableIds,
        fallbackPlayableIds,
        nextTarget,
        nextName: nextTarget ? map.countryData[nextTarget]?.name ?? nextTarget : null,
      });

      if (
        process.env.NODE_ENV !== "production" &&
        (clickedIso === "ID" ||
          nextTarget == null ||
          (nextTarget != null &&
            regionPlayableIds.length > 0 &&
            !isCountryInTarget(nextTarget, map.countryData[nextTarget], currentRegion.id)) ||
          (nextTarget != null &&
            regionPlayableIds.length === 0 &&
            broadRegionPlayableIds.length > 0 &&
            !isCountryInTarget(nextTarget, map.countryData[nextTarget], broadRegion.id)))
      ) {
        console.log("[nearby-country-selection]", {
          from: clickedIso,
          fromName: map.countryData[clickedIso]?.name ?? clickedIso,
          currentRegion: currentRegion.id,
          broadRegion: broadRegion.id,
          regionPlayableIds,
          broadRegionPlayableIds,
          fallbackPlayableIds,
          nextTarget,
          nextName: nextTarget ? map.countryData[nextTarget]?.name ?? nextTarget : null,
        });
        logNearbyPickCheck(
          map,
          regionPlayableIds,
          clickedIso,
          `${currentRegion.id} region candidates`,
        );
        logNearbyPickCheck(
          map,
          broadRegionPlayableIds,
          clickedIso,
          `${broadRegion.id} broad-region candidates`,
        );
        logNearbyPickCheck(map, fallbackPlayableIds, clickedIso, "world fallback");
      }

      setGuessed(nextGuessed);
      showSuccessBurst(clickedIso);
      setScore((s) => s + 1);
      setFeedback("correct");
      setGuessIso(null);
      setSearch("");
      hoveredIsoRef.current = null;
      wrongIdsRef.current.delete(clickedIso);
      paintMapState(clickedIso);

      if (nextTarget == null) {
        setClickedIso(null);
        queueMicrotask(() => endGame("win"));
      } else {
        queueMicrotask(() => selectCountryTarget(nextTarget));
      }

      window.setTimeout(() => setFeedback(null), 900);
    } else {
      wrongIdsRef.current.add(clickedIso);
      paintMapState(clickedIso);
      setPenalties((count) => count + 1);
      setFeedback("wrong");
      setGuessIso(null);
      setSearch("");
      window.setTimeout(() => setFeedback(null), 1200);
    }
  }, [
    clickedIso,
    guessIso,
    endGame,
    paintMapState,
    selectCountryTarget,
    showSuccessBurst,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (loading || gameOverReason != null || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key === "Enter") {
        const topOption = filteredOptions[0];
        if (!topOption) return;
        e.preventDefault();
        submitGuess(topOption.iso);
        return;
      }

      if (isTextEntryTarget(e.target)) return;

      if (e.key.length === 1) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setGuessIso(null);
        setSearch((prev) => prev + e.key);
      } else if (e.key === "Backspace" && search.length > 0) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setGuessIso(null);
        setSearch((prev) => prev.slice(0, -1));
      } else if (e.key === "Escape" && search.length > 0) {
        e.preventDefault();
        setGuessIso(null);
        setSearch("");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filteredOptions, gameOverReason, loading, search.length, submitGuess]);

  const zoomByFactor = useCallback((factor: number, centerX: number, centerY: number) => {
    stopViewAnimation();
    setView((prev) => {
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, prev.scale * factor),
      );
      if (nextScale === prev.scale) return prev;
      const newTx = centerX - (centerX - prev.x) * (nextScale / prev.scale);
      const newTy = centerY - (centerY - prev.y) * (nextScale / prev.scale);
      return { x: newTx, y: newTy, scale: nextScale };
    });
  }, [stopViewAnimation]);

  const resetView = useCallback(() => {
    stopViewAnimation();
    const objectEl = mapRef.current?.worldMap;
    const svgRoot = objectEl?.contentDocument?.documentElement as
      | SVGSVGElement
      | undefined;
    const fitView = objectEl && svgRoot ? getFitMapView(svgRoot, objectEl) : null;
    setView(fitView ?? { x: 0, y: 0, scale: 1 });
  }, [stopViewAnimation]);

  const getIsoAtPoint = useCallback((clientX: number, clientY: number) => {
    const objectEl = mapRef.current?.worldMap;
    const svgDocument = objectEl?.contentDocument;
    if (!objectEl || !svgDocument) return null;

    const rect = objectEl.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    const localX = ((clientX - rect.left) / rect.width) * objectEl.clientWidth;
    const localY = ((clientY - rect.top) / rect.height) * objectEl.clientHeight;
    return resolveIsoFromElement(svgDocument.elementFromPoint(localX, localY));
  }, []);

  useEffect(() => {
    const objectEl = mapRef.current?.worldMap;
    const svgRoot = objectEl?.contentDocument?.documentElement as
      | SVGSVGElement
      | undefined;
    if (!objectEl || !svgRoot) return;

    const targetBox = getViewBoxForView(svgRoot, objectEl, view);
    if (!targetBox) return;

    if (viewBoxAnimationRef.current != null) {
      cancelAnimationFrame(viewBoxAnimationRef.current);
      viewBoxAnimationRef.current = null;
    }

    if (!isViewAnimating) {
      setSvgViewBox(svgRoot, targetBox);
      return;
    }

    const startBox = parseViewBox(svgRoot.getAttribute("viewBox")) ?? targetBox;
    const startedAt = performance.now();
    const duration = 700;
    const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = easeOutQuart(progress);
      setSvgViewBox(svgRoot, {
        x: startBox.x + (targetBox.x - startBox.x) * eased,
        y: startBox.y + (targetBox.y - startBox.y) * eased,
        width: startBox.width + (targetBox.width - startBox.width) * eased,
        height: startBox.height + (targetBox.height - startBox.height) * eased,
      });

      if (progress < 1) {
        viewBoxAnimationRef.current = requestAnimationFrame(tick);
      } else {
        viewBoxAnimationRef.current = null;
      }
    };

    viewBoxAnimationRef.current = requestAnimationFrame(tick);
  }, [isViewAnimating, mapApi, view]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadScript(SCRIPT_SRC);
        if (cancelled || typeof window.svgWorldMap !== "function") {
          throw new Error("Map library failed to initialize");
        }

        const map = await window.svgWorldMap({
          libPath: "/svg-world-map/",
          bigMap: false,
          showOcean: true,
          showAntarctica: true,
          showLabels: false,
          showMicroLabels: false,
          showMicroStates: true,
          showInfoBox: false,
          groupCountries: false,
          mapClick: MAP_CLICK_FN,
          mapOver: MAP_OVER_FN,
          mapOut: MAP_OUT_FN,
          timeControls: false,
        });

        if (cancelled) return;

        mapRef.current = map;
        setMapApi(map);

        const container = document.getElementById("svg-world-map-container");
        const layer = transformLayerRef.current;
        if (container && layer) {
          layer.appendChild(container);
        }

        requestAnimationFrame(() => {
          const svgRoot = map.worldMap.contentDocument?.documentElement as
            | SVGSVGElement
            | undefined;
          const fitView = svgRoot ? getFitMapView(svgRoot, map.worldMap) : null;
          if (fitView) {
            viewRef.current = fitView;
            setView(fitView);
          }
        });

        const win = window as unknown as Record<string, (data: unknown) => void>;

        win[MAP_OVER_FN] = (data: unknown) => {
          const iso = resolveIsoFromClick(data);
          if (iso == null) return;
          map.over(iso);
        };

        win[MAP_OUT_FN] = (data: unknown) => {
          const iso = resolveIsoFromClick(data);
          if (iso == null) return;
          map.out(iso);
        };

        win[MAP_CLICK_FN] = (data: unknown) => {
          if (gameStateRef.current.ended || !gameStateRef.current.playing) {
            return;
          }
          const iso = resolveIsoFromClick(data);
          if (iso == null) return;
          if (guessedRef.current.has(iso)) return;
          if (
            !isCountryInTarget(
              iso,
              map.countryData[iso],
              "all",
            )
          ) {
            return;
          }

          selectCountryTargetRef.current(iso);
        };

        gameStateRef.current = { playing: true, ended: false };
        setLoading(false);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setLoading(false);
          setError(e instanceof Error ? e.message : "Failed to load map");
        }
      }
    })();

    return () => {
      cancelled = true;
      Reflect.deleteProperty(
        window as unknown as Record<string, unknown>,
        MAP_CLICK_FN,
      );
      Reflect.deleteProperty(
        window as unknown as Record<string, unknown>,
        MAP_OVER_FN,
      );
      Reflect.deleteProperty(
        window as unknown as Record<string, unknown>,
        MAP_OUT_FN,
      );
      document.getElementById("svg-world-map-container")?.remove();
    };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopViewAnimation();
      const rect = el.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_SENS);
      setView((prev) => {
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, prev.scale * factor),
        );
        if (nextScale === prev.scale) return prev;
        const newTx = lx - (lx - prev.x) * (nextScale / prev.scale);
        const newTy = ly - (ly - prev.y) * (nextScale / prev.scale);
        return { x: newTx, y: newTy, scale: nextScale };
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stopViewAnimation]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onCapturedClick = (e: MouseEvent) => {
      if (!suppressClickRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    };

    el.addEventListener("click", onCapturedClick, true);
    return () => el.removeEventListener("click", onCapturedClick, true);
  }, []);

  useEffect(() => {
    if (!mapApi) return;
    const firstCountry = Object.values(mapApi.countries)[0];
    const svgDocument = firstCountry?.ownerDocument;
    if (!svgDocument || svgDocument === document) return;

    const startPan = (e: PointerEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.button !== 0) return;
      stopViewAnimation();

      const v = viewRef.current;
      panSessionRef.current = {
        pointerId: e.pointerId,
        button: e.button,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startVx: v.x,
        startVy: v.y,
        isPanning: false,
      };
    };

    const movePan = (e: PointerEvent) => {
      const session = panSessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      const dx = e.clientX - session.startClientX;
      const dy = e.clientY - session.startClientY;

      if (!session.isPanning) {
        if (Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return;
        session.isPanning = true;
        setIsPanning(true);
      }

      e.preventDefault();
      setView({
        x: session.startVx + dx,
        y: session.startVy + dy,
        scale: viewRef.current.scale,
      });
    };

    const endPan = (e: PointerEvent) => {
      const session = panSessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;
      if (session.isPanning) {
        suppressClickRef.current = true;
        e.preventDefault();
      }
      panSessionRef.current = null;
      setIsPanning(false);
    };

    const suppressMouseAfterPan = (e: MouseEvent) => {
      if (!suppressClickRef.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    const clearSuppressedClick = (e: MouseEvent) => {
      if (!suppressClickRef.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      suppressClickRef.current = false;
    };

    const zoomWheel = (e: WheelEvent) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      e.preventDefault();
      stopViewAnimation();
      const rect = viewport.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_SENS);
      setView((prev) => {
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, prev.scale * factor),
        );
        if (nextScale === prev.scale) return prev;
        const newTx = lx - (lx - prev.x) * (nextScale / prev.scale);
        const newTy = ly - (ly - prev.y) * (nextScale / prev.scale);
        return { x: newTx, y: newTy, scale: nextScale };
      });
    };

    svgDocument.addEventListener("pointerdown", startPan, true);
    svgDocument.addEventListener("pointermove", movePan, true);
    svgDocument.addEventListener("pointerup", endPan, true);
    svgDocument.addEventListener("pointercancel", endPan, true);
    svgDocument.addEventListener("mouseup", suppressMouseAfterPan, true);
    svgDocument.addEventListener("click", clearSuppressedClick, true);
    svgDocument.addEventListener("wheel", zoomWheel, { passive: false, capture: true });

    return () => {
      svgDocument.removeEventListener("pointerdown", startPan, true);
      svgDocument.removeEventListener("pointermove", movePan, true);
      svgDocument.removeEventListener("pointerup", endPan, true);
      svgDocument.removeEventListener("pointercancel", endPan, true);
      svgDocument.removeEventListener("mouseup", suppressMouseAfterPan, true);
      svgDocument.removeEventListener("click", clearSuppressedClick, true);
      svgDocument.removeEventListener("wheel", zoomWheel, true);
    };
  }, [mapApi, stopViewAnimation]);

  useEffect(() => {
    if (loading || gameOverReason != null || playableIds.length === 0) return;
    if (clickedIso) return;

    const nextTarget = pickNextIso(playableIds);
    if (nextTarget) {
      queueMicrotask(() => selectCountryTarget(nextTarget));
    }
  }, [
    clickedIso,
    gameOverReason,
    loading,
    mapApi,
    playableIds,
    selectCountryTarget,
  ]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isTypingTarget(e.target)) return;
    if (e.button !== 0) return;
    stopViewAnimation();

    const v = viewRef.current;
    panSessionRef.current = {
      pointerId: e.pointerId,
      button: e.button,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startVx: v.x,
      startVy: v.y,
      isPanning: false,
    };
  }, [stopViewAnimation]);

  const endPanPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const session = panSessionRef.current;
    if (!session || e.pointerId !== session.pointerId) return;

    if (session.isPanning) {
      suppressClickRef.current = true;
    }

    panSessionRef.current = null;
    setIsPanning(false);

    try {
      viewportRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const session = panSessionRef.current;
    if (!session || e.pointerId !== session.pointerId) return;

    const dx = e.clientX - session.startClientX;
    const dy = e.clientY - session.startClientY;

    if (!session.isPanning) {
      if (session.button !== 1 && Math.hypot(dx, dy) < PAN_THRESHOLD_PX) {
        return;
      }
      session.isPanning = true;
      setIsPanning(true);
      try {
        viewportRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* events from the embedded SVG document cannot always be captured */
      }
    }

    setView({
      x: session.startVx + dx,
      y: session.startVy + dy,
      scale: viewRef.current.scale,
    });
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endPanPointer(e);
    },
    [endPanPointer],
  );

  const onMapPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (panSessionRef.current) return;
      const iso = getIsoAtPoint(e.clientX, e.clientY);
      const canHover =
        iso != null &&
        !guessedRef.current.has(iso) &&
        isCountryInTarget(
          iso,
          mapRef.current?.countryData[iso],
          "all",
        );
      const nextHover = canHover ? iso : null;
      if (hoveredIsoRef.current === nextHover) return;
      hoveredIsoRef.current = nextHover;
      syncMapHighlight(nextHover);
    },
    [getIsoAtPoint, syncMapHighlight],
  );

  const onMapPointerLeave = useCallback(() => {
    if (hoveredIsoRef.current == null) return;
    hoveredIsoRef.current = null;
    syncMapHighlight(null);
  }, [syncMapHighlight]);

  const onMapClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        debugMapFlow("onMapClick:suppressed-after-pan");
        return;
      }
      if (gameStateRef.current.ended || !gameStateRef.current.playing) return;

      const iso = getIsoAtPoint(e.clientX, e.clientY);
      debugMapFlow("onMapClick:resolved", {
        clientX: e.clientX,
        clientY: e.clientY,
        iso,
        name: iso && mapRef.current ? mapRef.current.countryData[iso]?.name ?? iso : null,
        guessed: iso ? guessedRef.current.has(iso) : null,
      });
      if (iso == null) return;
      if (guessedRef.current.has(iso)) return;
      if (
        !isCountryInTarget(
          iso,
          mapRef.current?.countryData[iso],
          "all",
        )
      ) {
        return;
      }

      selectCountryTarget(iso);
    },
    [getIsoAtPoint, selectCountryTarget],
  );

  useEffect(() => {
    if (loading || gameOverReason) return;
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          gameStateRef.current.playing = false;
          gameStateRef.current.ended = true;
          queueMicrotask(() => {
            setGameOverReason("time");
            hoveredIsoRef.current = null;
            paintMapState(null);
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [loading, gameOverReason, paintMapState]);

  const over = gameOverReason != null;

  const canSubmit =
    !over && !loading && clickedIso != null && guessIso != null;

  const remainingCount = mapApi === null ? null : playableIds.length;

  const scalePercent = Math.round(view.scale * 100);
  const currentRegion =
    clickedIso && mapApi ? getCountryRegionTarget(mapApi, clickedIso) : REGION_TARGETS[0];
  const currentRegionTheme = REGION_THEME[currentRegion.id];
  const regionProgress = useMemo(
    () => getRegionProgress(mapApi, guessed),
    [mapApi, guessed],
  );
  const totalCountries =
    mapApi === null ? 0 : score + (remainingCount === null ? 0 : remainingCount);
  const progressPercent =
    totalCountries === 0 ? 0 : Math.round((score / totalCountries) * 100);
  const selectedGuessName =
    guessIso && mapApi ? mapApi.countryData[guessIso]?.name ?? guessIso : null;
  const resultTitle =
    gameOverReason === "time"
      ? "Time is up"
      : gameOverReason === "surrender"
        ? "Run surrendered"
        : "You named every region";
  const resultCopy =
    gameOverReason === "win"
      ? "Clean sweep. Every available region was identified."
      : gameOverReason === "surrender"
        ? `You surrendered with ${score} ${
            score === 1 ? "region" : "regions"
          } named and ${penalties} ${
            penalties === 1 ? "penalty" : "penalties"
          }.`
      : `You finished with ${score} ${
          score === 1 ? "region" : "regions"
        } named and ${penalties} ${
          penalties === 1 ? "penalty" : "penalties"
        }.`;
  const elapsedTime = GAME_DURATION_SEC - timeLeft;
  const resultStats = [
    { label: "Named", value: String(score) },
    {
      label: "Remaining",
      value: remainingCount === null ? "..." : String(remainingCount),
    },
    { label: "Total", value: String(totalCountries) },
    { label: "Progress", value: `${progressPercent}%` },
    { label: "Penalties", value: String(penalties) },
    { label: "Time used", value: formatTime(elapsedTime) },
  ];
  const guessedFlags = useMemo(
    () => Array.from(guessed).sort().map((iso) => ({ iso })),
    [guessed],
  );

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#f8fafc_34%,#eef2ff_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,#0f172a_0,#020617_45%,#030712_100%)] dark:text-slate-50">
      <section className="relative flex min-w-0 flex-1 p-2 sm:p-4 lg:p-5">
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-4xl border border-white/80 bg-sky-100 shadow-2xl shadow-slate-200/70 ring-1 ring-slate-900/5 dark:border-white/10 dark:bg-slate-950 dark:shadow-black/40 dark:ring-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.28)_1px,transparent_1px)] bg-size-[48px_48px] opacity-60 dark:opacity-10" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(15,23,42,0.08)_78%)] dark:bg-[radial-gradient(circle_at_center,transparent_0,rgba(0,0,0,0.42)_78%)]" />

          <div
            ref={viewportRef}
            className={`world-map-mount map-viewport relative min-h-0 flex-1 select-none ${
              isPanning ? "cursor-grabbing" : "cursor-grab"
            }`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              ref={transformLayerRef}
              className="pointer-events-auto absolute inset-0"
            />
            <div
              className="absolute inset-0 z-10"
              onPointerMove={onMapPointerMove}
              onPointerLeave={onMapPointerLeave}
              onClick={onMapClick}
            />
            {successBurst && (
              <div
                key={`map-${successBurst.id}`}
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: successBurst.mapX,
                  top: successBurst.mapY,
                }}
              >
                <div className="success-burst-float relative text-2xl font-black text-emerald-400 drop-shadow-[0_8px_18px_rgba(16,185,129,0.65)] [-webkit-text-stroke:1px_white]">
                  +1
                </div>
              </div>
            )}
            {regionArrow && (
              <div
                className="pointer-events-none absolute z-20 flex -translate-x-1/2 -translate-y-[calc(100%+4px)] flex-col items-center"
                style={{
                  left: regionArrow.x,
                  top: regionArrow.y,
                }}
                aria-hidden
                title={regionArrow.label}
              >
                <div className="rounded-full border border-red-200 bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-xl shadow-red-950/25">
                  Here
                </div>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 sm:left-5 sm:top-5">
            <div className="rounded-full border border-white/70 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:text-sky-300">
              Click Map
            </div>
            {!loading && !error && (
              <div className="rounded-full border border-white/70 bg-white/80 px-3 py-2 text-xs font-medium text-slate-600 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300">
                Drag to pan / Wheel to zoom / Type to answer / {scalePercent}%
              </div>
            )}
          </div>

          {DEBUG_MAP_FLOW && (
            <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-amber-300/70 bg-amber-50/90 px-4 py-3 text-xs font-semibold text-amber-950 shadow-xl shadow-slate-900/10 backdrop-blur dark:border-amber-400/30 dark:bg-amber-950/75 dark:text-amber-100 sm:bottom-5 sm:left-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
                Debug selected
              </p>
              {selectedCountryDebug ? (
                <p className="mt-1">
                  {selectedCountryDebug.iso} / {selectedCountryDebug.name} /{" "}
                  {selectedCountryDebug.regionLabel} / broad{" "}
                  {selectedCountryDebug.broadRegionLabel} / guessed{" "}
                  {selectedCountryDebug.guessed ? "yes" : "no"}
                </p>
              ) : (
                <p className="mt-1">No selected country</p>
              )}
            </div>
          )}

          {!loading && !error && (
            <div className="pointer-events-none absolute right-4 top-4 flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-950/80 sm:right-5 sm:top-5">
              <div className="pointer-events-auto grid grid-cols-2 divide-x divide-slate-200 dark:divide-white/10">
                <button
                  type="button"
                  aria-label="Zoom in"
                  className="flex h-11 w-12 items-center justify-center text-xl font-semibold text-slate-800 transition hover:bg-sky-50 active:bg-sky-100 dark:text-slate-100 dark:hover:bg-white/10"
                  onClick={() => {
                    const el = viewportRef.current;
                    if (!el) return;
                    const r = el.getBoundingClientRect();
                    zoomByFactor(1.22, r.width / 2, r.height / 2);
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label="Zoom out"
                  className="flex h-11 w-12 items-center justify-center text-xl font-semibold text-slate-800 transition hover:bg-sky-50 active:bg-sky-100 dark:text-slate-100 dark:hover:bg-white/10"
                  onClick={() => {
                    const el = viewportRef.current;
                    if (!el) return;
                    const r = el.getBoundingClientRect();
                    zoomByFactor(1 / 1.22, r.width / 2, r.height / 2);
                  }}
                >
                  -
                </button>
              </div>
              <button
                type="button"
                className="pointer-events-auto border-t border-slate-200 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 transition hover:bg-sky-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10"
                onClick={resetView}
              >
                Reset
              </button>
            </div>
          )}

          {loading && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/65 text-slate-700 backdrop-blur-md dark:bg-slate-950/70 dark:text-slate-200">
              <div
                className="h-11 w-11 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"
                aria-hidden
              />
              <p className="text-sm font-semibold">Loading world map...</p>
            </div>
          )}
        </div>
      </section>

      <aside className="absolute inset-x-2 bottom-2 z-10 flex max-h-[58vh] flex-col rounded-[1.75rem] border border-white/80 bg-white/90 shadow-2xl shadow-slate-900/15 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/88 sm:inset-x-4 sm:bottom-4 lg:inset-y-5 lg:left-auto lg:right-5 lg:max-h-none lg:w-[420px]">
        <header className="shrink-0 border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
                Click Map
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                Name the highlighted region
              </h1>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={surrender}
                disabled={loading || over}
                className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-400/20 dark:text-rose-300 dark:hover:bg-rose-500/10"
              >
                Surrender
              </button>
              <button
                type="button"
                onClick={restart}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Restart
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-950 px-3 py-3 text-white dark:bg-white dark:text-slate-950">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-65">
                Time
              </p>
              <p className="mt-1 font-mono text-lg font-black tabular-nums">
                {formatTime(timeLeft)}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-3 py-3 text-amber-800 dark:bg-amber-950/35 dark:text-amber-200">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-65">
                Penalty
              </p>
              <p
                className="mt-1 text-lg font-black tabular-nums"
                aria-label={`${penalties} wrong guesses`}
              >
                {penalties}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-sky-50 px-3 py-3 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-65">
                Score
              </p>
              <p className="mt-1 text-lg font-black tabular-nums">
                {score}
              </p>
              {successBurst && (
                <span
                  key={`score-${successBurst.id}`}
                  className="success-burst-score pointer-events-none absolute right-3 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-black text-white shadow-lg shadow-emerald-500/40"
                >
                  +1
                </span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>{progressPercent}% complete</span>
              <span>
                {remainingCount === null ? "..." : remainingCount} remaining
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-sky-500 transition-[width]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200/80 bg-white/70 p-3 shadow-inner shadow-white/60 dark:border-white/10 dark:bg-white/3 dark:shadow-none">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Region progress
              </p>
              <p className={`text-xs font-black ${currentRegionTheme.text}`}>
                {currentRegion.id === "all"
                  ? "World route"
                  : `Now in ${currentRegion.shortLabel}`}
              </p>
            </div>

            <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto pr-1">
              {regionProgress.map(({ target, guessed: done, total, percent }) => {
                const theme = REGION_THEME[target.id];
                const active = target.id === currentRegion.id;
                return (
                  <div
                    key={target.id}
                    className={`rounded-2xl border p-2.5 transition ${
                      active
                        ? `${theme.chip} shadow-lg shadow-slate-900/10 ring-2 ring-white/80 dark:ring-white/10`
                        : "border-slate-200/70 bg-white/55 dark:border-white/10 dark:bg-white/3"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.dot} shadow-[0_0_14px_currentColor]`}
                        />
                        <span className={`truncate text-xs font-black ${theme.text}`}>
                          {target.label}
                        </span>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
                        {done}/{total}
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200/80 shadow-inner dark:bg-white/10">
                      <div
                        className={`h-full rounded-full bg-linear-to-r ${theme.bar} shadow-[0_0_18px_rgba(14,165,233,0.35)] transition-[width] duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : over ? (
            <div className="flex flex-1 flex-col justify-between gap-6">
              <div className="rounded-3xl bg-slate-950 p-5 text-white dark:bg-white dark:text-slate-950">
                <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-60">
                  Game over
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight">
                  {resultTitle}
                </p>
                <p className="mt-3 text-sm leading-relaxed opacity-75">
                  {resultCopy}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {resultStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl bg-white/10 px-3 py-3 dark:bg-slate-950/8"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">
                        {stat.label}
                      </p>
                      <p className="mt-1 font-mono text-xl font-black tabular-nums">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl bg-white/10 p-3 dark:bg-slate-950/8">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">
                      Guessed flags
                    </p>
                    <p className="text-xs font-bold opacity-60">
                      {guessedFlags.length}
                    </p>
                  </div>
                  {guessedFlags.length === 0 ? (
                    <p className="mt-3 text-sm font-semibold opacity-70">
                      No regions guessed yet.
                    </p>
                  ) : (
                    <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {guessedFlags.map(({ iso }) => {
                        const FlagComponent =
                          CountryFlags[iso as keyof typeof CountryFlags];
                        return (
                          <span
                            key={iso}
                            title={iso}
                            aria-label={iso}
                            className="flex h-7 w-10 items-center justify-center overflow-hidden rounded-sm bg-white/15 ring-1 ring-white/20"
                          >
                            {FlagComponent ? (
                              <FlagComponent className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-black">{iso}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-2xl bg-sky-600 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-sky-600/25 transition hover:bg-sky-500 active:scale-[0.99]"
                >
                  Play again
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Current target
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {clickedIso
                    ? "Highlighted on the map. Type the region name, then press Enter."
                    : "Choosing a target from the selected region..."}
                </p>
              </div>

              <label
                htmlFor="country-search"
                className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
              >
                Answer
              </label>
              <input
                id="country-search"
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setGuessIso(null);
                }}
                placeholder="Start typing anywhere..."
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none ring-sky-500/20 transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
              />

              {selectedGuessName && (
                <p className="mt-2 text-xs font-semibold text-sky-700 dark:text-sky-300">
                  Selected: {selectedGuessName}
                </p>
              )}

              <ul
                role="listbox"
                aria-label="Regions not yet guessed"
                className="mt-3 min-h-[132px] flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5"
              >
                {filteredOptions.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                    {playableIds.length === 0
                      ? "Nothing left to guess."
                      : "No matches. Try another search."}
                  </li>
                ) : (
                  filteredOptions.map(({ iso, name }) => (
                    <li key={iso}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={guessIso === iso}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-sky-50 dark:hover:bg-white/10 ${
                          guessIso === iso
                            ? "bg-sky-100 font-bold text-sky-950 dark:bg-sky-500/20 dark:text-sky-100"
                            : "text-slate-800 dark:text-slate-200"
                        }`}
                        onClick={() => {
                          setGuessIso(iso);
                          setSearch(name);
                        }}
                      >
                        <span>{name}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                          {iso}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>

              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => submitGuess()}
                className="mt-4 rounded-2xl bg-slate-950 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                Submit answer
              </button>

              {feedback === "correct" && (
                <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                  Correct. That region is cleared.
                </p>
              )}
              {feedback === "wrong" && (
                <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
                  Not a match for the highlighted region.
                </p>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
