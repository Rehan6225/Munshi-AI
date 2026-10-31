import type { jsPDF as JsPDF } from "jspdf";
import type { CellHookData } from "jspdf-autotable";
import type { MonthReport } from "./report";

/*
 * Layout follows the usual money-app monthly recap: one headline number, a few summary
 * cards, a category donut with a legend, a six-month trend, then the detail tables.
 * One brand green carries the meaning; everything else is greys.
 */
type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const INK = hex("#1A1D1C");
const BODY = hex("#3D4341");
const MUTED = hex("#7A817E");
const RULE = hex("#E3E6E4");
const CARD = hex("#F5F7F6");
const TRACK = hex("#E9ECEA");
const GREEN = hex("#0E7A57");
const GREEN_SOFT = hex("#CFE6DC");
const AMBER = hex("#B7791F");
const RED = hex("#B4423A");
const WHITE: RGB = [255, 255, 255];
// Shades of one family, darkest for the biggest category.
const SLICES = ["#0E7A57", "#3E9C7D", "#76BBA2", "#A9D3C2", "#C6B48C", "#9AA3A0", "#D3D8D5"].map(
  hex,
);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 44;
const W = PAGE_W - M * 2;

/** The built-in PDF fonts have no ₹ glyph, so amounts read "Rs 1,20,000". */
const rs = (n: number) =>
  `${n < 0 ? "-" : ""}Rs ${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const rsShort = (n: number) =>
  n >= 100000
    ? `${(n / 100000).toFixed(1)}L`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : `${Math.round(n)}`;
const clean = (s: string) => s.replace(/₹\s?/g, "Rs ").replace(/[—–]/g, "-").replace(/[’‘]/g, "'");

/** Number columns are right-aligned; their headings should line up with them. */
const alignHead = (d: CellHookData, cols: number[]) => {
  if (d.section === "head" && cols.includes(d.column.index)) d.cell.styles.halign = "right";
};

interface Options {
  demo: boolean;
  /** Shown under the headline when the income is a stand-in. */
  incomeNote?: string | null;
}

/** Builds the month's report as a PDF and downloads it. */
export async function downloadReportPdf(r: MonthReport, opts: Options) {
  const doc = await createReportPdf(r, opts);
  doc.save(`munshi-report-${r.month}${opts.demo ? "-demo" : ""}.pdf`);
}

export async function createReportPdf(r: MonthReport, opts: Options): Promise<JsPDF> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const text = (c: RGB) => doc.setTextColor(...c);
  const fill = (c: RGB) => doc.setFillColor(...c);
  const font = (size: number, style: "normal" | "bold" = "normal") =>
    doc.setFont("helvetica", style).setFontSize(size);
  const rule = (at: number, c: RGB = RULE, width = 0.6) =>
    doc
      .setDrawColor(...c)
      .setLineWidth(width)
      .line(M, at, PAGE_W - M, at);
  const tableEnd = () =>
    (doc as JsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const brand = (y: number) => {
    fill(GREEN);
    doc.roundedRect(M, y - 13, 18, 18, 5, 5, "F");
    text(WHITE);
    font(10, "bold").text("Rs", M + 9, y - 0.5, { align: "center" });
    text(INK);
    font(11, "bold").text("Munshi AI", M + 26, y);
  };
  const headed = new Set<number>();
  const runningHeader = () => {
    // Tables call this for every page they touch; draw it once per page.
    const page = doc.getCurrentPageInfo().pageNumber;
    if (headed.has(page)) return 80;
    headed.add(page);
    brand(42);
    text(MUTED);
    font(9).text(`Monthly report · ${r.label}`, PAGE_W - M, 42, { align: "right" });
    rule(56);
    return 80;
  };
  let y = 0;
  const room = (needed: number) => {
    if (y + needed > PAGE_H - 64) {
      doc.addPage();
      y = runningHeader();
    }
  };
  /** `keep` is the space the content after the title needs, so they stay on one page. */
  const heading = (title: string, sub?: string, keep = 70) => {
    room(keep);
    text(INK);
    font(12, "bold").text(title, M, y);
    if (sub) {
      text(MUTED);
      font(9).text(clean(sub), PAGE_W - M, y, { align: "right" });
    }
    y += 18;
  };

  // ── Page 1 ──
  y = runningHeader();
  text(MUTED);
  font(9).text(
    `${r.count} payments${opts.demo ? " · Demo data" : ""} · Prepared ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    M,
    y,
  );
  y += 30;

  // Headline: what was saved, or what was spent when we don't know the income
  if (r.income !== null && r.saved !== null && r.savingsRate !== null) {
    const over = r.saved < 0;
    text(MUTED);
    font(10).text(over ? "You spent more than you earned by" : "You saved", M, y);
    text(over ? RED : GREEN);
    font(30, "bold").text(rs(Math.abs(r.saved)), M, y + 32);
    text(BODY);
    font(10).text(
      over
        ? `Spent ${rs(r.spent)} against an income of ${rs(r.income)}`
        : `${r.savingsRate}% of your ${rs(r.income)} income`,
      M,
      y + 50,
    );
    y += 70;
    // Income split into spent and saved
    const spentW = Math.min(1, r.spent / r.income) * W;
    fill(TRACK);
    doc.roundedRect(M, y, W, 10, 5, 5, "F");
    fill(over ? RED : BODY);
    doc.roundedRect(M, y, Math.max(10, spentW), 10, 5, 5, "F");
    if (!over) {
      fill(GREEN);
      doc.roundedRect(M + spentW - 5, y, Math.max(10, W - spentW + 5), 10, 5, 5, "F");
      fill(over ? RED : BODY);
      doc.rect(M + spentW - 6, y, 6, 10, "F");
    }
    y += 24;
    const legend: [RGB, string][] = [
      [over ? RED : BODY, `Spent ${rs(r.spent)}`],
      ...(!over ? ([[GREEN, `Saved ${rs(r.saved)}`]] as [RGB, string][]) : []),
    ];
    let lx = M;
    for (const [c, label] of legend) {
      fill(c);
      doc.circle(lx + 4, y - 3, 3.5, "F");
      text(BODY);
      font(9).text(label, lx + 12, y);
      lx += doc.getTextWidth(label) + 34;
    }
    y += 14;
  } else {
    text(MUTED);
    font(10).text("You spent", M, y);
    text(INK);
    font(30, "bold").text(rs(r.spent), M, y + 32);
    y += 50;
  }
  if (opts.incomeNote || r.income === null) {
    text(MUTED);
    font(8.5).text(
      clean(
        opts.incomeNote ??
          "Add your monthly salary in Munshi AI to see what you saved and your savings rate.",
      ),
      M,
      y + 4,
    );
    y += 14;
  }
  y += 22;

  // Summary cards
  const lastSpent = r.trend.at(-2)?.amount ?? 0;
  const change = lastSpent ? Math.round(((r.spent - lastSpent) / lastSpent) * 100) : null;
  const cards: { label: string; value: string; sub: string; subTone?: RGB }[] = [
    {
      label: "Spent",
      value: rs(r.spent),
      sub:
        change === null
          ? "No data for last month"
          : `${change > 0 ? "+" : ""}${change}% vs ${r.trend.at(-2)!.label}`,
      ...(change !== null && { subTone: change > 0 ? RED : GREEN }),
    },
    {
      label: "Payments",
      value: String(r.count),
      sub: `About ${rs(r.count ? r.spent / r.count : 0)} each`,
    },
    {
      label: "Bills & subscriptions",
      value: rs(r.subscriptionsMonthly),
      sub: `${r.subscriptions.length} active, per month`,
    },
  ];
  const cardW = (W - 24) / 3;
  cards.forEach((c, i) => {
    const x = M + i * (cardW + 12);
    fill(CARD);
    doc.roundedRect(x, y, cardW, 70, 8, 8, "F");
    text(MUTED);
    font(8.5).text(c.label, x + 14, y + 20);
    text(INK);
    font(16, "bold").text(c.value, x + 14, y + 42);
    text(c.subTone ?? MUTED);
    font(8.5).text(c.sub, x + 14, y + 58);
  });
  y += 100;

  // Category donut with legend
  heading("Where your money went", `${rs(r.spent)} in ${r.label.split(" ")[0]}`);
  const cats = r.categories.slice(0, 7);
  const cx = M + 82;
  const cy = y + 82;
  const R = 74;
  const hole = 46;
  let angle = -Math.PI / 2;
  cats.forEach((c, i) => {
    const sweep = c.share * Math.PI * 2;
    const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 90)));
    const pts: [number, number][] = [];
    for (let k = 0; k <= steps; k++) {
      const a = angle + (sweep * k) / steps;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    for (let k = steps; k >= 0; k--) {
      const a = angle + (sweep * k) / steps;
      pts.push([cx + hole * Math.cos(a), cy + hole * Math.sin(a)]);
    }
    const deltas = pts.slice(1).map((p, j) => [p[0] - pts[j]![0], p[1] - pts[j]![1]]);
    fill(SLICES[i % SLICES.length]!);
    doc.lines(deltas, pts[0]![0], pts[0]![1], [1, 1], "F", true);
    angle += sweep;
  });
  // Thin white gaps between slices
  angle = -Math.PI / 2;
  doc.setDrawColor(...WHITE).setLineWidth(1.5);
  for (const c of cats) {
    doc.line(
      cx + hole * Math.cos(angle),
      cy + hole * Math.sin(angle),
      cx + (R + 1) * Math.cos(angle),
      cy + (R + 1) * Math.sin(angle),
    );
    angle += c.share * Math.PI * 2;
  }
  text(INK);
  font(13, "bold").text(`Rs ${rsShort(r.spent)}`, cx, cy + 2, { align: "center" });
  text(MUTED);
  font(8).text("spent", cx, cy + 14, { align: "center" });

  const lx = M + 190;
  const lw = PAGE_W - M - lx;
  const rowH = Math.min(22, 164 / Math.max(cats.length, 1));
  let ly = cy - (cats.length * rowH) / 2 + rowH / 2 + 3;
  cats.forEach((c, i) => {
    fill(SLICES[i % SLICES.length]!);
    doc.roundedRect(lx, ly - 7, 8, 8, 2, 2, "F");
    text(INK);
    font(9.5).text(c.category, lx + 16, ly);
    font(9.5, "bold").text(rs(c.amount), lx + lw - 42, ly, { align: "right" });
    text(MUTED);
    font(9).text(`${Math.round(c.share * 100)}%`, lx + lw, ly, { align: "right" });
    if (i < cats.length - 1) {
      doc
        .setDrawColor(...RULE)
        .setLineWidth(0.5)
        .line(lx, ly + rowH / 2 - 2, lx + lw, ly + rowH / 2 - 2);
    }
    ly += rowH;
  });
  y = cy + R + 34;

  // Notes, kept compact so they fit under the summary
  if (r.highlights.length) {
    heading("Things to note");
    r.highlights.forEach((h, i) => {
      const lines = doc.splitTextToSize(clean(h.text), W - 18) as string[];
      room(lines.length * 12 + 12);
      fill(h.tone === "good" ? GREEN : h.tone === "warn" ? AMBER : MUTED);
      doc.circle(M + 3, y - 3, 2.5, "F");
      text(BODY);
      font(9.5).text(lines, M + 14, y);
      y += lines.length * 12 + 4;
      if (i < r.highlights.length - 1) rule(y, RULE, 0.4);
      y += 12;
    });
  }

  // ── Detail pages ──
  doc.addPage();
  y = runningHeader();

  // Six-month trend
  heading("Spending over six months", "Total spent each month");
  const chartH = 100;
  const maxAmt = Math.max(...r.trend.map((t) => t.amount), 1);
  const slot = W / r.trend.length;
  const base = y + chartH;
  r.trend.forEach((t, i) => {
    const h = t.amount ? Math.max(3, (chartH - 18) * (t.amount / maxAmt)) : 0;
    const bw = Math.min(46, slot * 0.5);
    const x = M + i * slot + (slot - bw) / 2;
    const current = i === r.trend.length - 1;
    fill(current ? GREEN : GREEN_SOFT);
    if (h) doc.roundedRect(x, base - h, bw, h, 3, 3, "F");
    text(current ? INK : BODY);
    font(8.5, current ? "bold" : "normal").text(
      t.amount ? `Rs ${rsShort(t.amount)}` : "-",
      x + bw / 2,
      base - h - 6,
      { align: "center" },
    );
    text(MUTED);
    font(9).text(t.label, x + bw / 2, base + 15, { align: "center" });
  });
  rule(base, RULE, 0.8);
  y = base + 56;

  /** Rough height of a table with a heading row, for keeping it on one page. */
  const tableHeight = (rows: number) => Math.min(520, 40 + (rows + 1) * 27);
  const table = {
    theme: "plain" as const,
    showFoot: "lastPage" as const,
    margin: { top: 80, left: M, right: M },
    didDrawPage: () => void runningHeader(),
    styles: {
      fontSize: 9,
      cellPadding: { top: 7, bottom: 7, left: 8, right: 8 },
      textColor: BODY,
    },
    headStyles: { fontStyle: "bold" as const, textColor: MUTED, fontSize: 8, fillColor: CARD },
    alternateRowStyles: { fillColor: [250, 251, 250] as RGB },
    bodyStyles: { lineWidth: { bottom: 0.4 }, lineColor: RULE },
  };

  if (r.changes.length && r.previousLabel) {
    heading(
      `Compared with ${r.previousLabel}`,
      "Biggest changes first",
      tableHeight(r.changes.length),
    );
    autoTable(doc, {
      ...table,
      startY: y,
      head: [["Category", "This month", "Last month", "Change"]],
      body: r.changes.map((c) => [
        c.category,
        rs(c.now),
        rs(c.before),
        c.diff === 0 ? "No change" : `${c.diff > 0 ? "+" : "-"}${rs(Math.abs(c.diff))}`,
      ]),
      columnStyles: {
        0: { textColor: INK },
        1: { halign: "right", textColor: INK },
        2: { halign: "right" },
        3: { halign: "right", fontStyle: "bold" },
      },
      didParseCell: (d) => {
        alignHead(d, [1, 2, 3]);
        if (d.section !== "body" || d.column.index !== 3) return;
        const diff = r.changes[d.row.index]!.diff;
        d.cell.styles.textColor = diff > 0 ? RED : diff < 0 ? GREEN : MUTED;
      },
    });
    y = tableEnd() + 36;
  }

  if (r.merchants.length) {
    heading("Where you paid the most", undefined, tableHeight(r.merchants.length));
    autoTable(doc, {
      ...table,
      startY: y,
      head: [["Merchant", "Payments", "Total"]],
      body: r.merchants.map((m) => [clean(m.name), String(m.count), rs(m.amount)]),
      columnStyles: {
        0: { textColor: INK },
        1: { halign: "right" },
        2: { halign: "right", fontStyle: "bold", textColor: INK },
      },
      didParseCell: (d) => alignHead(d, [1, 2]),
    });
    y = tableEnd() + 36;
  }

  if (r.subscriptions.length) {
    heading(
      "Subscriptions and bills",
      `${rs(r.subscriptionsMonthly * 12)} a year in total`,
      tableHeight(r.subscriptions.length + 1),
    );
    autoTable(doc, {
      ...table,
      startY: y,
      head: [["Name", "Billed", "Amount", "Per year", "Note"]],
      body: r.subscriptions.map((s) => [
        clean(s.name),
        s.cycle,
        rs(s.amount),
        rs(s.yearly),
        clean(s.note) || (s.kind === "bill" ? "Bill" : ""),
      ]),
      foot: [["Total per month", "", rs(r.subscriptionsMonthly), "", ""]],
      footStyles: { fontStyle: "bold", textColor: INK, fillColor: CARD },
      columnStyles: {
        0: { textColor: INK },
        2: { halign: "right" },
        3: { halign: "right", fontStyle: "bold", textColor: INK },
        4: { cellWidth: 140 },
      },
      didParseCell: (d) => {
        alignHead(d, [2, 3]);
        if (d.section === "foot" && d.column.index === 2) d.cell.styles.halign = "right";
        if (d.section === "body" && d.column.index === 4 && r.subscriptions[d.row.index]!.note) {
          d.cell.styles.textColor = AMBER;
        }
      },
    });
    y = tableEnd() + 36;
  }

  if (r.goals.length) {
    heading("Goals");
    for (const g of r.goals) {
      const note = doc.splitTextToSize(clean(g.note), W - 28) as string[];
      const boxH = 62 + note.length * 12;
      room(boxH + 10);
      const tone = g.status === "At risk" ? RED : g.status === "On track" ? AMBER : GREEN;
      const pct = g.target > 0 ? Math.min(1, g.saved / g.target) : 0;
      fill(CARD);
      doc.roundedRect(M, y, W, boxH, 8, 8, "F");
      text(INK);
      font(10.5, "bold").text(clean(g.name), M + 14, y + 20);
      text(tone);
      font(9, "bold").text(g.status, PAGE_W - M - 14, y + 20, { align: "right" });
      fill(TRACK);
      doc.roundedRect(M + 14, y + 29, W - 28, 6, 3, 3, "F");
      fill(tone === AMBER ? GREEN : tone);
      doc.roundedRect(M + 14, y + 29, Math.max(6, (W - 28) * pct), 6, 3, 3, "F");
      text(MUTED);
      font(8.5).text(
        `${rs(g.saved)} of ${rs(g.target)} (${Math.round(pct * 100)}%) · by ${new Date(g.due).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} · needs ${rs(g.neededPerMonth)} a month`,
        M + 14,
        y + 48,
      );
      text(BODY);
      font(9).text(note, M + 14, y + 62);
      y += boxH + 10;
    }
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    rule(PAGE_H - 44);
    text(MUTED);
    font(7.5).text(
      "Munshi AI explains your money and models scenarios. It doesn't recommend investments.",
      M,
      PAGE_H - 30,
    );
    doc.text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 30, { align: "right" });
  }

  return doc;
}
