import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { BoxLogo } from "@/components/BoxLogo";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  DownloadCloud,
  Hourglass,
  Layers,
  LogOut,
  Star,
  Sun,
  Timer,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { MENU } from "@/data/menu";
import { LivreurStatsSection } from "@/components/LivreurStatsSection";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: DashboardPage,
});

interface OrderRow {
  id: string;
  status: "pending" | "accepted" | "ready" | "delivering" | "delivered" | "refused" | "expired" | "cancelled";
  created_at: string;
  updated_at: string;
  accepted_at?: string | null;
  refusal_reason?: string | null;
  total: number;
  address?: string | null;
  city?: string | null;
}

interface ItemRow {
  order_id: string;
  name: string;
  qty: number;
}

interface RatingRow {
  order_id: string;
  rating: number | null;
  comment: string | null;
  created_at: string;
  dismissed: boolean | null;
}

const NAME_TO_CATEGORY: Record<string, string> = MENU.reduce((acc, item) => {
  acc[item.name] = item.category;
  return acc;
}, {} as Record<string, string>);

const CATEGORY_LABEL: Record<string, string> = {
  burgers: "Burgers",
  formules: "Formules",
  viande: "Viande",
  pates: "Pâtes",
  boissons: "Boissons",
  pizzas: "Pizzas",
  sandwichs: "Sandwichs",
  entrees: "Entrées",
};

function serviceFromHour(hour: number): "Matin" | "Midi" | "Soir" {
  if (hour < 11) return "Matin";
  if (hour < 17) return "Midi";
  return "Soir";
}

function DashboardPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const periodValid = !!startDate && !!endDate && endDate >= startDate;

  // Raccourcis de période : pré-remplissent start/end utilisés par l'export.
  // Les heures sont normalisées par exportExcel (00:00:00 → 23:59:59).
  function setQuickRange(kind: "today" | "month" | "year") {
    const now = new Date();
    const end = new Date(now);
    let start: Date;
    if (kind === "today") start = new Date(now);
    else if (kind === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
    else start = new Date(now.getFullYear(), 0, 1);
    setStartDate(start);
    setEndDate(end);
  }

  useEffect(() => {
    (async () => {
      const { data: os, error: e1 } = await supabase.from("orders").select("*");
      if (e1) {
        toast.error(e1.message);
        setLoading(false);
        return;
      }

      const { data: its, error: e2 } = await supabase
        .from("order_items")
        .select("order_id, name, qty");
      if (e2) {
        toast.error(e2.message);
      }

      // Avis clients : on récupère toutes les colonnes utiles au calcul des
      // statistiques. Le filtrage (dismissed / rating NULL / période) est
      // appliqué côté client dans le useMemo `ratingStats`.
      const { data: rts, error: e3 } = await supabase
        .from("order_ratings")
        .select("order_id, rating, comment, created_at, dismissed");
      if (e3) {
        toast.error(e3.message);
      }

      setOrders((os as OrderRow[]) ?? []);
      setItems((its as ItemRow[]) ?? []);
      setRatings((rts as RatingRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const orderById = new Map(orders.map((order) => [order.id, order]));

    const soldItems = items.filter((item) => {
      const status = orderById.get(item.order_id)?.status;
      return status !== "pending" && status !== "refused" && status !== "expired" && status !== "cancelled";
    });

    const dishCounts = new Map<string, number>();
    for (const item of soldItems) {
      dishCounts.set(item.name, (dishCounts.get(item.name) ?? 0) + Number(item.qty));
    }
    const topDishes = [...dishCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const categoryCounts = new Map<string, number>();
    for (const item of soldItems) {
      const category = NAME_TO_CATEGORY[item.name] ?? "autre";
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + Number(item.qty));
    }
    const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
    const totalCategoryItems = topCategories.reduce((sum, [, qty]) => sum + qty, 0);

    // "Temps d'acceptation" / "Délai moyen" : basés sur l'ÉVÉNEMENT d'acceptation
    // (accepted_at), pas sur le statut courant. Une commande acceptée puis passée
    // à ready/delivering/delivered n'a plus status = 'accepted' mais garde son
    // accepted_at, et doit donc compter. Le délai est created_at -> accepted_at.
    const acceptedOrders = orders.filter((order) => order.accepted_at != null);
    const refusedOrders = orders.filter((order) => order.status === "refused");
    const expiredOrders = orders.filter((order) => order.status === "expired");
    const cancelledOrders = orders.filter((order) => order.status === "cancelled");

    const acceptDurations = acceptedOrders
      .map((order) => (new Date(order.accepted_at as string).getTime() - new Date(order.created_at).getTime()) / 1000)
      .filter((duration) => duration >= 0 && duration < 60 * 60);

    const avgSec = acceptDurations.length ? acceptDurations.reduce((sum, value) => sum + value, 0) / acceptDurations.length : 0;
    const minSec = acceptDurations.length ? Math.min(...acceptDurations) : 0;
    const maxSec = acceptDurations.length ? Math.max(...acceptDurations) : 0;

    const serviceMap: Record<"Matin" | "Midi" | "Soir", number> = { Matin: 0, Midi: 0, Soir: 0 };
    for (const item of soldItems) {
      const order = orderById.get(item.order_id);
      if (!order) continue;
      serviceMap[serviceFromHour(new Date(order.created_at).getHours())] += Number(item.qty);
    }

    const unavailable = refusedOrders.filter((order) => order.refusal_reason === "unavailable").length;
    const busy = refusedOrders.filter((order) => order.refusal_reason === "busy").length;
    const noReason = refusedOrders.length - unavailable - busy;

    return {
      topDishes,
      topCategories,
      totalCategoryItems,
      avgSec,
      minSec,
      maxSec,
      acceptCount: acceptDurations.length,
      serviceMap,
      refused: refusedOrders.length,
      unavailable,
      busy,
      noReason,
      expired: expiredOrders.length,
      cancelled: cancelledOrders.length,
      totalOrders: orders.length,
    };
  }, [orders, items]);

  // Statistiques des avis clients (table order_ratings).
  // Règle transverse : on exclut TOUJOURS les lignes dismissed = true ou dont
  // rating est NULL. Les calculs respectent la période sélectionnée (start/end)
  // lorsqu'elle est valide ; sinon ils portent sur l'ensemble des avis.
  const ratingStats = useMemo(() => {
    const from = startDate ? new Date(startDate) : null;
    if (from) from.setHours(0, 0, 0, 0);
    const to = endDate ? new Date(endDate) : null;
    if (to) to.setHours(23, 59, 59, 999);

    const valid = ratings.filter((r) => {
      if (r.dismissed === true) return false;
      if (r.rating == null) return false;
      if (periodValid && from && to) {
        const t = new Date(r.created_at).getTime();
        if (t < from.getTime() || t > to.getTime()) return false;
      }
      return true;
    });

    const count = valid.length;
    const avg = count ? valid.reduce((sum, r) => sum + (r.rating as number), 0) / count : 0;

    // Répartition 1→5.
    const distribution = [1, 2, 3, 4, 5].map((value) => ({
      rating: value,
      label: `${value}★`,
      count: valid.filter((r) => Math.round(r.rating as number) === value).length,
    }));

    // Évolution de la moyenne par jour (ordre chronologique).
    const perDay = new Map<string, { sum: number; n: number }>();
    for (const r of valid) {
      const day = format(new Date(r.created_at), "yyyy-MM-dd");
      const entry = perDay.get(day) ?? { sum: 0, n: 0 };
      entry.sum += r.rating as number;
      entry.n += 1;
      perDay.set(day, entry);
    }
    const trend = [...perDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, { sum, n }]) => ({
        day,
        label: format(new Date(day), "dd/MM"),
        avg: Number((sum / n).toFixed(2)),
      }));

    // Plats les mieux notés : on rattache la note de chaque commande à chacun
    // des plats distincts qu'elle contient (jointure order_ratings.order_id →
    // order_items.order_id, regroupée par order_items.name). Le "nombre d'avis"
    // est le nombre de commandes notées ayant contenu ce plat. Aucun seuil
    // minimum d'avis n'est appliqué pour l'instant.
    const namesByOrder = new Map<string, Set<string>>();
    for (const item of items) {
      const set = namesByOrder.get(item.order_id) ?? new Set<string>();
      set.add(item.name);
      namesByOrder.set(item.order_id, set);
    }
    const dishAgg = new Map<string, { sum: number; n: number }>();
    for (const r of valid) {
      const names = namesByOrder.get(r.order_id);
      if (!names) continue;
      for (const name of names) {
        const entry = dishAgg.get(name) ?? { sum: 0, n: 0 };
        entry.sum += r.rating as number;
        entry.n += 1;
        dishAgg.set(name, entry);
      }
    }
    const topRatedDishes = [...dishAgg.entries()]
      .map(([name, { sum, n }]) => ({ name, avg: sum / n, count: n }))
      .sort((a, b) => b.avg - a.avg || b.count - a.count)
      .slice(0, 5);

    return { count, avg, distribution, trend, topRatedDishes };
  }, [ratings, items, startDate, endDate, periodValid]);

  const maxDish = stats.topDishes[0]?.[1] ?? 1;
  const maxService = Math.max(1, ...Object.values(stats.serviceMap));

  // Note française avec 1 décimale (ex. 4,3). Utilisé pour l'affichage des notes.
  const fmtRating1 = (value: number) => value.toFixed(1).replace(".", ",");

  const fmtSec = (seconds: number) =>
    seconds < 60
      ? `${Math.round(seconds)} s`
      : `${Math.floor(seconds / 60)} min ${String(Math.round(seconds % 60)).padStart(2, "0")}`;

  const getDisplayDate = (date: Date | null, fallback: string) =>
    date ? format(date, "yyyy-MM-dd") : fallback;

  const EXCEL_HEADER_FILL = { fgColor: { rgb: "FF1F2937" } };
  const EXCEL_ODD_ROW_FILL = { fgColor: { rgb: "FFF8FAFC" } };
  const EXCEL_EVEN_ROW_FILL = { fgColor: { rgb: "FFFFFFFF" } };
  const EXCEL_BORDER = {
    top: { style: "thin", color: { rgb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { rgb: "FFCBD5E1" } },
    left: { style: "thin", color: { rgb: "FFCBD5E1" } },
    right: { style: "thin", color: { rgb: "FFCBD5E1" } },
  };

  // Une commande acceptée par le restaurant progresse ensuite
  // (accepted -> ready -> delivering -> delivered) : son statut courant n'est
  // donc pas forcément "accepted". On considère comme acceptée toute commande à
  // ce statut ou au-delà. Valeurs strictement conformes à l'enum order_status.
  const ACCEPTED_ORDER_STATUSES = new Set(["accepted", "ready", "delivering", "delivered"]);
  const DINAR_FORMAT = "#,##0.000 \"DT\"";
  const formatDinar = (value: number) =>
    `${value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;

  const SHEET_TAB_COLORS: Record<string, string> = {
    "Vue d'ensemble": "FF1D4ED8",
    "Historique des commandes": "FFBE185D",
    "Top plats vendus": "FF0F766E",
    "Catégories les plus vendues": "FF92400E",
    "Temps d'acceptation": "FF0EA5E9",
    "Ventes par créneau": "FF059669",
    "Commandes refusées": "FFB91C1C",
    "Commandes expirées": "FF7C3AED",
    "Avis": "FFF59E0B",
  };

  const applyCellStyles = (cell: any, style: Record<string, unknown>) => {
    cell.s = { ...(cell.s ?? {}), ...style };
  };

  const setCurrencyColumns = (sheet: XLSX.WorkSheet, headers: string[]) => {
    const currencyHeaders = new Set(["Montant total", "Montant", "Chiffre d'affaires total", "Panier moyen"]);
    const currencyCols = headers.reduce<number[]>((cols, header, index) => {
      if (currencyHeaders.has(header)) cols.push(index);
      return cols;
    }, []);

    if (!sheet["!ref"] || currencyCols.length === 0) return;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (const col of currencyCols) {
      for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[address] as any;
        if (!cell || cell.t !== "n") continue;
        cell.z = DINAR_FORMAT;
      }
    }
  };

  const getWorksheetColWidths = (rows: unknown[][]) =>
    rows[0]
      ? rows[0].map((_, colIndex) => {
          const maxLength = rows.reduce((max, row) => {
            const cell = row[colIndex];
            const text = cell === null || cell === undefined ? "" : String(cell);
            return Math.max(max, text.length);
          }, 10);
          return { wch: Math.min(40, Math.max(10, maxLength + 2)) };
        })
      : [];

  const styleSheet = (sheet: XLSX.WorkSheet) => {
    sheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" } as any;
    const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    if (!range) return;

    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const isHeader = row === range.s.r;
      const fill = isHeader ? EXCEL_HEADER_FILL : row % 2 === 0 ? EXCEL_EVEN_ROW_FILL : EXCEL_ODD_ROW_FILL;

      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[address];
        if (!cell) continue;

        const alignment = {
          vertical: "center" as const,
          horizontal: isHeader ? "center" : cell.t === "n" ? "right" : "left",
          wrapText: !isHeader,
        };

        applyCellStyles(cell, {
          border: EXCEL_BORDER,
          fill,
          alignment,
        });

        if (isHeader) {
          applyCellStyles(cell, {
            font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 12 },
          });
        }
      }
    }
  };

  const makeSheet = (headers: string[], rows: unknown[][], tabColor?: string) => {
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    sheet["!cols"] = getWorksheetColWidths([headers, ...rows]);
    styleSheet(sheet);
    setCurrencyColumns(sheet, headers);
    if (tabColor) {
      (sheet as any)["!tabColor"] = { rgb: tabColor };
    }
    return sheet;
  };

  const makeOverviewSheet = (
    startDate: Date,
    endDate: Date,
    overviewValues: {
      totalOrders: number;
      refused: number;
      expired: number;
      cancelled: number;
      avgAccept: string;
      totalRevenue: number;
      panierMoyen: number;
      acceptanceRate: number;
      biggestOrder: string;
      smallestOrder: string;
      bestDay: string;
    },
  ) => {
    const title = `Dashboard BOX - Vue d'ensemble (${format(startDate, "yyyy-MM-dd")} au ${format(endDate, "yyyy-MM-dd")})`;
    const subtitle = "Récapitulatif des commandes sur la période sélectionnée";

    const rows: unknown[][] = [
      [title, null, null, null],
      [subtitle, null, null, null],
      [
        "COMMANDES TOTALES",
        "REFUSÉES",
        "EXPIRÉES",
        "ANNULÉES",
      ],
      [overviewValues.totalOrders, overviewValues.refused, overviewValues.expired, overviewValues.cancelled],
      [
        "DÉLAI MOYEN D'ACCEPTATION (SECONDES)",
        "CHIFFRE D'AFFAIRES TOTAL",
        "PANIER MOYEN",
        "TAUX D'ACCEPTATION",
      ],
      [overviewValues.avgAccept, overviewValues.totalRevenue, overviewValues.panierMoyen, overviewValues.acceptanceRate],
      [null, null, null, null],
      ["DÉTAILS COMMANDES", null, null, null],
      ["Libellé", "Valeur", null, null],
      ["Commande la plus chère", overviewValues.biggestOrder, null, null],
      ["Commande la moins chère", overviewValues.smallestOrder, null, null],
      ["Jour avec le plus de commandes", overviewValues.bestDay, null, null],
    ];

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 7, c: 0 }, e: { r: 7, c: 3 } },
    ];
    sheet["!cols"] = Array(4).fill({ wch: 24 });
    sheet["!rows"] = [
      { hpt: 26 },
      { hpt: 16 },
      { hpt: 20 },
      { hpt: 34 },
      { hpt: 20 },
      { hpt: 34 },
      { hpt: 9 },
      { hpt: 22 },
      { hpt: 18 },
      { hpt: 18 },
      { hpt: 18 },
      { hpt: 18 },
    ];

    const styleCell = (address: string, style: Record<string, unknown>) => {
      const cell = sheet[address] as any;
      if (!cell) return;
      cell.s = { ...(cell.s ?? {}), ...style };
    };

    const cardLabelStyle = {
      fill: { fgColor: { rgb: "FFF1F5F9" } },
      font: { bold: true, color: { rgb: "FF334155" }, sz: 10 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: EXCEL_BORDER,
    };

    const cardValueStyle = {
      fill: { fgColor: { rgb: "FFFFFFFF" } },
      font: { bold: true, color: { rgb: "FF0F172A" }, sz: 18 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: EXCEL_BORDER,
    };

    const cardHeaders = [2, 4];
    for (let col = 0; col < 4; col += 1) {
      styleCell(XLSX.utils.encode_cell({ r: 2, c: col }), cardLabelStyle);
      styleCell(XLSX.utils.encode_cell({ r: 4, c: col }), cardLabelStyle);
      styleCell(XLSX.utils.encode_cell({ r: 3, c: col }), cardValueStyle);
      styleCell(XLSX.utils.encode_cell({ r: 5, c: col }), cardValueStyle);
    }

    styleCell("A1", {
      font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 16 },
      fill: { fgColor: { rgb: "FF1F2937" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: EXCEL_BORDER,
    });
    styleCell("A2", {
      font: { italic: true, color: { rgb: "FF64748B" }, sz: 10 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: EXCEL_BORDER,
    });

    for (let col = 1; col < 4; col += 1) {
      styleCell(XLSX.utils.encode_cell({ r: 0, c: col }), { fill: { fgColor: { rgb: "FF1F2937" } } });
      styleCell(XLSX.utils.encode_cell({ r: 1, c: col }), { fill: { fgColor: { rgb: "FFFFFFFF" } } });
    }

    styleCell("A7", {
      font: { bold: true, color: { rgb: "FF1F2937" }, sz: 12 },
      fill: { fgColor: { rgb: "FFFDE68A" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: EXCEL_BORDER,
    });
    for (let col = 1; col < 4; col += 1) {
      styleCell(XLSX.utils.encode_cell({ r: 7, c: col }), {
        fill: { fgColor: { rgb: "FFFDE68A" } },
        border: EXCEL_BORDER,
      });
    }

    styleCell("A8", {
      fill: { fgColor: { rgb: "FF334155" } },
      font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 11 },
      alignment: { horizontal: "center", vertical: "center" },
      border: EXCEL_BORDER,
    });
    styleCell("B8", {
      fill: { fgColor: { rgb: "FF334155" } },
      font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 11 },
      alignment: { horizontal: "center", vertical: "center" },
      border: EXCEL_BORDER,
    });

    for (let row = 9; row <= 11; row += 1) {
      styleCell(XLSX.utils.encode_cell({ r: row, c: 0 }), {
        fill: { fgColor: { rgb: "FFFFFFFF" } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: EXCEL_BORDER,
        font: { color: { rgb: "FF0F172A" }, sz: 11 },
      });
      styleCell(XLSX.utils.encode_cell({ r: row, c: 1 }), {
        fill: { fgColor: { rgb: "FFFFFFFF" } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: EXCEL_BORDER,
        font: { color: { rgb: "FF0F172A" }, sz: 11 },
      });
      styleCell(XLSX.utils.encode_cell({ r: row, c: 2 }), { border: EXCEL_BORDER });
      styleCell(XLSX.utils.encode_cell({ r: row, c: 3 }), { border: EXCEL_BORDER });
    }

    const acceptanceCell = sheet[XLSX.utils.encode_cell({ r: 5, c: 3 })] as any;
    if (acceptanceCell) {
      acceptanceCell.t = "n";
      acceptanceCell.z = "0.00%";
      acceptanceCell.v = overviewValues.acceptanceRate;
    }

    const revenueCell = sheet[XLSX.utils.encode_cell({ r: 5, c: 1 })] as any;
    if (revenueCell) {
      revenueCell.t = "n";
      revenueCell.z = DINAR_FORMAT;
      revenueCell.v = overviewValues.totalRevenue;
    }

    const panierCell = sheet[XLSX.utils.encode_cell({ r: 5, c: 2 })] as any;
    if (panierCell) {
      panierCell.t = "n";
      panierCell.z = DINAR_FORMAT;
      panierCell.v = overviewValues.panierMoyen;
    }

    return sheet;
  };

  const exportExcel = async () => {
    if (!startDate || !endDate) return;
    setExporting(true);

    try {
      const from = new Date(startDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(endDate);
      to.setHours(23, 59, 59, 999);

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: true });
      if (ordersError) throw ordersError;
      const periodOrders = (ordersData as OrderRow[]) ?? [];
      const orderIds = periodOrders.map((order) => order.id);

      const periodItemsResult = orderIds.length
        ? await supabase.from("order_items").select("order_id, name, qty").in("order_id", orderIds)
        : { data: [] as ItemRow[], error: null };
      if (periodItemsResult.error) throw periodItemsResult.error;
      const periodItems = (periodItemsResult.data as ItemRow[]) ?? [];

      const orderItemsMap = new Map<string, ItemRow[]>();
      for (const item of periodItems) {
        orderItemsMap.set(item.order_id, [...(orderItemsMap.get(item.order_id) ?? []), item]);
      }

      const refusedOrders = periodOrders.filter((order) => order.status === "refused");
      const expiredOrders = periodOrders.filter((order) => order.status === "expired");
      const acceptedOrders = periodOrders.filter((order) => ACCEPTED_ORDER_STATUSES.has(order.status));
      const salesOrders = periodOrders.filter((order) => ACCEPTED_ORDER_STATUSES.has(order.status));

      const totalRevenue = salesOrders.reduce((sum, order) => sum + order.total, 0);
      const panierMoyen = acceptedOrders.length ? totalRevenue / acceptedOrders.length : 0;
      const acceptanceDenominator = acceptedOrders.length + refusedOrders.length + expiredOrders.length;
      const acceptanceRate = acceptanceDenominator ? acceptedOrders.length / acceptanceDenominator : 0;

      // Temps d'acceptation : basé sur l'événement accepted_at (created_at ->
      // accepted_at), indépendamment du statut courant. Jeu de données distinct
      // de `acceptedOrders` (qui sert au CA/panier) pour ne pas altérer les ventes.
      const acceptedAtOrders = periodOrders.filter((order) => order.accepted_at != null);
      const acceptDurations = acceptedAtOrders
        .map((order) => (new Date(order.accepted_at as string).getTime() - new Date(order.created_at).getTime()) / 1000)
        .filter((duration) => duration >= 0 && duration < 60 * 60);
      const acceptCount = acceptDurations.length;
      const minAccept = acceptCount ? Math.min(...acceptDurations) : 0;
      const maxAccept = acceptCount ? Math.max(...acceptDurations) : 0;
      const avgAccept = acceptCount ? acceptDurations.reduce((sum, value) => sum + value, 0) / acceptCount : 0;

      const dailyCounts = periodOrders.reduce((acc, order) => {
        const day = format(new Date(order.created_at), "yyyy-MM-dd");
        acc[day] = (acc[day] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const bestDay = Object.keys(dailyCounts).reduce((best, current) => {
        if (!best) return current;
        return dailyCounts[current] > dailyCounts[best] ? current : best;
      }, "");

      const topDishes = Array.from(
        periodItems.reduce((acc, item) => {
          acc.set(item.name, (acc.get(item.name) ?? 0) + item.qty);
          return acc;
        }, new Map<string, number>()).entries(),
      ).sort((a, b) => b[1] - a[1]);

      const categoryMap = new Map<string, number>();
      for (const item of periodItems) {
        const category = NAME_TO_CATEGORY[item.name] ?? "autre";
        categoryMap.set(category, (categoryMap.get(category) ?? 0) + item.qty);
      }
      const categoryRows = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
      const categoryTotal = categoryRows.reduce((sum, [, qty]) => sum + qty, 0);

      const topPlatsRows =
        topDishes.length > 0
          ? topDishes.map(([name, qty]) => [name, qty])
          : [["Aucune donnée sur cette période", ""]];

      const categoriesRows =
        categoryRows.length > 0
          ? categoryRows.map(([category, qty]) => [CATEGORY_LABEL[category] ?? category, qty, categoryTotal ? qty / categoryTotal : 0])
          : [["Aucune donnée sur cette période", "", ""]];

      const acceptanceRows = [
        ["Nombre de commandes utilisées", acceptCount],
        ["Min (s)", Math.round(minAccept)],
        ["Moyenne (s)", Math.round(avgAccept)],
        ["Max (s)", Math.round(maxAccept)],
      ];

      const serviceRows = [
        ["Matin", periodOrders.filter((order) => serviceFromHour(new Date(order.created_at).getHours()) === "Matin").length],
        ["Midi", periodOrders.filter((order) => serviceFromHour(new Date(order.created_at).getHours()) === "Midi").length],
        ["Soir", periodOrders.filter((order) => serviceFromHour(new Date(order.created_at).getHours()) === "Soir").length],
      ];

      const refusedRowsFormatted =
        refusedOrders.length > 0
          ? refusedOrders.map((order) => [
              order.id,
              format(new Date(order.created_at), "yyyy-MM-dd"),
              order.refusal_reason?.trim() || "Non renseigné",
            ])
          : [["Aucune donnée sur cette période", "", ""]];

      const expiredRowsFormatted =
        expiredOrders.length > 0
          ? expiredOrders.map((order) => [
              order.id,
              format(new Date(order.created_at), "yyyy-MM-dd"),
              format(new Date(order.created_at), "HH:mm"),
              order.total,
            ])
          : [["Aucune donnée sur cette période", "", "", ""]];

      const historyRows =
        periodOrders.length > 0
          ? periodOrders.map((order) => {
              const orderItems = orderItemsMap.get(order.id) ?? [];
              const itemsText = orderItems.map((item) => `${item.qty}x ${item.name}`).join(", ");
              const acceptSeconds = order.accepted_at
                ? Math.round((new Date(order.accepted_at).getTime() - new Date(order.created_at).getTime()) / 1000)
                : "";
              return [
                order.id,
                format(new Date(order.created_at), "yyyy-MM-dd"),
                format(new Date(order.created_at), "HH:mm"),
                itemsText || "",
                order.total,
                order.status,
                acceptSeconds,
                order.address ?? "",
                // Ville issue de l'adresse liée à la commande (orders.city).
                // Vide si absente : aucune valeur inventée.
                order.city ?? "",
              ];
            })
          : [["Aucune donnée sur cette période", "", "", "", "", "", "", "", ""]];

      const biggestOrder =
        periodOrders.length > 0
          ? periodOrders.reduce((max, order) => (order.total > max.total ? order : max), periodOrders[0])
          : null;
      const smallestOrder =
        periodOrders.length > 0
          ? periodOrders.reduce((min, order) => (order.total < min.total ? order : min), periodOrders[0])
          : null;

      const overviewRows = [
        ["Nombre total de commandes", periodOrders.length],
        ["Refusées", refusedOrders.length],
        ["Expirées", expiredOrders.length],
        ["Annulées", periodOrders.filter((order) => order.status === "cancelled").length],
        ["Délai moyen d'acceptation (s)", Math.round(avgAccept)],
        ["Chiffre d'affaires total", totalRevenue],
        ["Panier moyen", Number(panierMoyen.toFixed(3))],
        ["Taux d'acceptation", acceptanceRate],
        [
          "Commande la plus chère",
          biggestOrder ? `${biggestOrder.id} (${formatDinar(biggestOrder.total)})` : "",
        ],
        [
          "Commande la moins chère",
          smallestOrder ? `${smallestOrder.id} (${formatDinar(smallestOrder.total)})` : "",
        ],
        ["Jour avec le plus de commandes", bestDay || ""],
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        makeOverviewSheet(startDate, endDate, {
          totalOrders: periodOrders.length,
          refused: refusedOrders.length,
          expired: expiredOrders.length,
          cancelled: periodOrders.filter((order) => order.status === "cancelled").length,
          avgAccept: `${Math.round(avgAccept)} s`,
          totalRevenue,
          panierMoyen,
          acceptanceRate,
          biggestOrder: biggestOrder ? formatDinar(biggestOrder.total) : "",
          smallestOrder: smallestOrder ? formatDinar(smallestOrder.total) : "",
          bestDay: bestDay || "",
        }),
        "Vue d'ensemble",
      );

      const sheets = [
        {
          name: "Historique des commandes",
          headers: ["ID commande", "Date", "Heure", "Items", "Montant total", "Statut", "Temps d'acceptation (s)", "Adresse de livraison", "Ville"],
          rows: historyRows,
        },
        { name: "Top plats vendus", headers: ["Plat", "Quantité vendue"], rows: topPlatsRows },
        {
          name: "Catégories les plus vendues",
          headers: ["Catégorie", "Quantité", "Pourcentage"],
          rows: categoriesRows,
        },
        { name: "Temps d'acceptation", headers: ["Statistique", "Valeur"], rows: acceptanceRows },
        { name: "Ventes par créneau", headers: ["Créneau", "Commandes"], rows: serviceRows },
        { name: "Commandes refusées", headers: ["ID commande", "Date", "Motif"], rows: refusedRowsFormatted },
        { name: "Commandes expirées", headers: ["ID commande", "Date", "Heure", "Montant"], rows: expiredRowsFormatted },
      ];

      for (const sheetDef of sheets) {
        XLSX.utils.book_append_sheet(
          workbook,
          makeSheet(sheetDef.headers, sheetDef.rows, SHEET_TAB_COLORS[sheetDef.name]),
          sheetDef.name,
        );
      }

      workbook.Workbook = {
        Sheets: workbook.SheetNames.map((name) => ({
          name,
          TabColor: { rgb: SHEET_TAB_COLORS[name] ?? "FF9CA3AF" },
        })),
      } as any;

      const filename = `box_rapport_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, filename, { bookType: "xlsx", cellStyles: true });
      toast.success("Export Excel généré avec succès.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la génération de l'export Excel.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/admin" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <BoxLogo size={30} showWordmark={false} />
            <h1 className="text-lg font-black">Dashboard</h1>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Déconnecté");
            }}
            className="flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold"
          >
            <LogOut className="h-4 w-4" /> Sortir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-5">
        {/* Raccourcis de période (en plus du calendrier personnalisé ci-dessous) */}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setQuickRange("today")}>
            Aujourd'hui
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setQuickRange("month")}>
            Ce mois-ci
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setQuickRange("year")}>
            Cette année
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center">
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between text-left">
                Du : {getDisplayDate(startDate, "Choisir une date")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate ?? undefined}
                onSelect={(date) => {
                  if (date instanceof Date) {
                    setStartDate(date);
                    if (endDate && date > endDate) setEndDate(date);
                    setStartOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>

          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between text-left">
                Au : {getDisplayDate(endDate, "Choisir une date")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate ?? undefined}
                onSelect={(date) => {
                  if (date instanceof Date) {
                    setEndDate(date);
                    setEndOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>

          <Button onClick={exportExcel} disabled={!periodValid || exporting} className="w-full">
            <DownloadCloud className="mr-2 h-4 w-4" />
            {exporting ? "Génération…" : "Exporter Excel"}
          </Button>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <KpiCard label="Commandes" value={String(stats.totalOrders)} />
              <KpiCard label="Refusées" value={String(stats.refused)} tone="danger" />
              <KpiCard label="Expirées" value={String(stats.expired)} tone="muted" />
              <KpiCard label="Annulées" value={String(stats.cancelled)} tone="muted" />
              <KpiCard
                label="Délai moyen"
                value={stats.acceptCount ? fmtSec(stats.avgSec) : "—"}
                tone="brand"
              />
            </div>

            <Card icon={<Trophy className="h-5 w-5" />} title="Top 5 plats vendus">
              {stats.topDishes.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-2">
                  {stats.topDishes.map(([name, qty], index) => (
                    <li key={name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-semibold">
                          {index + 1}. {name}
                        </span>
                        <span className="font-black text-brand">{qty}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-[#B22222]" style={{ width: `${(qty / maxDish) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card icon={<Layers className="h-5 w-5" />} title="Catégories les plus vendues">
              {stats.topCategories.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-2">
                  {stats.topCategories.map(([cat, qty]) => {
                    const pct = stats.totalCategoryItems ? Math.round((qty / stats.totalCategoryItems) * 100) : 0;
                    return (
                      <li key={cat}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-semibold">{CATEGORY_LABEL[cat] ?? cat}</span>
                          <span className="text-muted-foreground">
                            <span className="font-black text-foreground">{qty}</span> · {pct}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full bg-[#B22222]" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card icon={<Timer className="h-5 w-5" />} title="Temps d'acceptation">
              {stats.acceptCount === 0 ? (
                <Empty label="Aucune commande acceptée." />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Min" value={fmtSec(stats.minSec)} />
                  <MiniStat label="Moyen" value={fmtSec(stats.avgSec)} highlight />
                  <MiniStat label="Max" value={fmtSec(stats.maxSec)} />
                  <div className="col-span-3 text-xs text-muted-foreground">
                    Basé sur {stats.acceptCount} commande(s) acceptée(s).
                  </div>
                </div>
              )}
            </Card>

            <Card icon={<Sun className="h-5 w-5" />} title="Ventes par service (créneau horaire)">
              <p className="mb-3 text-xs text-muted-foreground">
                Matin (&lt;11h) · Midi (11–17h) · Soir (≥17h)
              </p>
              <div className="space-y-2">
                {(["Matin", "Midi", "Soir"] as const).map((service) => (
                  <div key={service}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold">{service}</span>
                      <span className="font-black">{stats.serviceMap[service]}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-[#B22222]" style={{ width: `${(stats.serviceMap[service] / maxService) * 100}%` }} />

                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card icon={<XCircle className="h-5 w-5" />} title="Commandes refusées">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Total" value={String(stats.refused)} />
                <MiniStat label="Plat non dispo." value={String(stats.unavailable)} />
                <MiniStat label="Restaurant occupé" value={String(stats.busy)} />
              </div>
              {stats.noReason > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {stats.noReason} refus sans motif enregistré.
                </p>
              )}
            </Card>

            <Card icon={<Hourglass className="h-5 w-5" />} title="Commandes expirées (auto)">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-brand">{stats.expired}</span>
                <span className="text-sm text-muted-foreground">non répondues sous 2 min</span>
              </div>
            </Card>

            <Card icon={<Star className="h-5 w-5" />} title="Statistiques des avis">
              {ratingStats.count === 0 ? (
                <Empty label="Aucun avis pour l'instant." />
              ) : (
                <div className="space-y-6">
                  {/* 1. Note moyenne globale — même style que les cartes métriques */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <KpiCard
                      label="Note moyenne"
                      value={`${fmtRating1(ratingStats.avg)} ★`}
                      tone="brand"
                    />
                    <KpiCard label="Avis" value={String(ratingStats.count)} />
                  </div>

                  {/* 2. Répartition des notes */}
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Répartition des notes
                    </h3>
                    <div className="h-[220px] w-full text-muted-foreground">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={ratingStats.distribution}
                          margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="currentColor"
                            strokeOpacity={0.15}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: "currentColor" }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: "currentColor" }}
                          />
                          <RechartsTooltip
                            cursor={{ fill: "#B22222", fillOpacity: 0.08 }}
                            formatter={(value: number) => [value, "Avis"]}
                            labelFormatter={(label: string) => `Note ${label}`}
                          />
                          <Bar
                            dataKey="count"
                            fill="#B22222"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={48}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 3. Évolution de la note moyenne dans le temps */}
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Évolution de la note moyenne
                    </h3>
                    <div className="h-[220px] w-full text-muted-foreground">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={ratingStats.trend}
                          margin={{ top: 8, right: 12, bottom: 0, left: -20 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="currentColor"
                            strokeOpacity={0.15}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: "currentColor" }}
                          />
                          <YAxis
                            domain={[0, 5]}
                            ticks={[0, 1, 2, 3, 4, 5]}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: "currentColor" }}
                          />
                          <RechartsTooltip
                            formatter={(value: number) => [fmtRating1(value), "Note moyenne"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="avg"
                            stroke="#B22222"
                            strokeWidth={2}
                            dot={{ r: 3, fill: "#B22222" }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 4. Plats les mieux notés (top 5) */}
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Plats les mieux notés
                    </h3>
                    {ratingStats.topRatedDishes.length === 0 ? (
                      <Empty label="Aucun plat noté pour l'instant." />
                    ) : (
                      <ul className="space-y-2">
                        {ratingStats.topRatedDishes.map((dish, index) => (
                          <li key={dish.name}>
                            <div className="mb-1 flex justify-between gap-2 text-sm">
                              <span className="font-semibold">
                                {index + 1}. {dish.name}
                              </span>
                              <span className="whitespace-nowrap font-black text-brand">
                                {fmtRating1(dish.avg)}★{" "}
                                <span className="font-semibold text-muted-foreground">
                                  · {dish.count} avis
                                </span>
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full bg-[#B22222]"
                                style={{ width: `${(dish.avg / 5) * 100}%` }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <LivreurStatsSection />
          </>
        )}
      </main>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide">
        <span className="text-brand">{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brand" | "danger" | "muted";
}) {
  const cls =
    tone === "danger"
      ? "text-destructive"
      : tone === "muted"
      ? "text-muted-foreground"
      : tone === "brand"
      ? "text-brand"
      : "text-foreground";
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-black ${cls}`}>{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-brand bg-[#B22222]/5" : ""}`}>
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-black ${highlight ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}

function Empty({ label = "Aucune donnée pour l'instant." }: { label?: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}
