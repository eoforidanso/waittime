/**
 * exportAnalyticsPDF
 * Captures the live analytics page with html2canvas and builds a multi-page
 * A4 PDF via jsPDF.  Each logical section that overflows a page is split
 * automatically.
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// A4 dimensions in mm
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10; // mm on all sides
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_H = PAGE_H - MARGIN * 2;

// Brand palette
const COLOR_ACCENT  = '#3b82f6';
const COLOR_DARK    = '#0f172a';
const COLOR_MID     = '#334155';
const COLOR_LIGHT   = '#94a3b8';
const COLOR_SURFACE = '#f8fafc';
const COLOR_BORDER  = '#e2e8f0';

// ── helpers ──────────────────────────────────────────────────────────────────
function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function setFill(pdf: jsPDF, hex: string) {
  pdf.setFillColor(...hexToRGB(hex));
}
function setTextColor(pdf: jsPDF, hex: string) {
  pdf.setTextColor(...hexToRGB(hex));
}
function setDrawColor(pdf: jsPDF, hex: string) {
  pdf.setDrawColor(...hexToRGB(hex));
}

// ── KPI card ─────────────────────────────────────────────────────────────────
interface KPI {
  label: string;
  value: string | number;
  sub: string;
  color: string;
}

function drawKPICard(
  pdf: jsPDF,
  kpi: KPI,
  x: number, y: number, w: number, h: number,
) {
  // Card background
  setFill(pdf, COLOR_SURFACE);
  setDrawColor(pdf, COLOR_BORDER);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Coloured left bar
  setFill(pdf, kpi.color);
  pdf.roundedRect(x, y, 2, h, 1, 1, 'F');

  // Value
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  setTextColor(pdf, kpi.color);
  pdf.text(String(kpi.value), x + 5, y + h * 0.45);

  // Label
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  setTextColor(pdf, COLOR_MID);
  pdf.text(kpi.label, x + 5, y + h * 0.65);

  // Sub
  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  setTextColor(pdf, COLOR_LIGHT);
  const subLines = pdf.splitTextToSize(kpi.sub, w - 7);
  pdf.text(subLines[0] ?? '', x + 5, y + h * 0.82);
}

// ── Section header ────────────────────────────────────────────────────────────
function drawSectionHeader(pdf: jsPDF, title: string, y: number) {
  setFill(pdf, COLOR_DARK);
  pdf.rect(MARGIN, y, CONTENT_W, 6, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  setTextColor(pdf, '#ffffff');
  pdf.text(title, MARGIN + 3, y + 4.2);
}

// ── Stat row (label : value pairs) ───────────────────────────────────────────
function drawStatTable(
  pdf: jsPDF,
  rows: Array<{ label: string; value: string; color?: string }>,
  x: number, y: number, colW: number, rowH = 6.5,
): number {
  rows.forEach((row, i) => {
    const rx = x;
    const ry = y + i * rowH;
    // Alternating row shade
    if (i % 2 === 0) {
      setFill(pdf, '#f1f5f9');
      pdf.rect(rx, ry, colW, rowH, 'F');
    }
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    setTextColor(pdf, COLOR_MID);
    pdf.text(row.label, rx + 2, ry + rowH - 2);

    pdf.setFont('helvetica', 'bold');
    setTextColor(pdf, row.color ?? COLOR_DARK);
    pdf.text(String(row.value), rx + colW - 2, ry + rowH - 2, { align: 'right' });
  });
  return y + rows.length * rowH;
}

// ── Page header / footer ──────────────────────────────────────────────────────
function drawPageChrome(pdf: jsPDF, pageNum: number, totalPages: number, reportDate: string) {
  // Top bar
  setFill(pdf, COLOR_DARK);
  pdf.rect(0, 0, PAGE_W, 8, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  setTextColor(pdf, '#ffffff');
  pdf.text('MediQ GH  ·  ER Analytics Report', MARGIN, 5.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text(reportDate, PAGE_W - MARGIN, 5.5, { align: 'right' });

  // Bottom bar
  setFill(pdf, '#e2e8f0');
  pdf.rect(0, PAGE_H - 6, PAGE_W, 6, 'F');
  setTextColor(pdf, COLOR_LIGHT);
  pdf.setFontSize(6.5);
  pdf.text('Confidential — mediqgh.com — For Clinical Use Only', MARGIN, PAGE_H - 1.8);
  pdf.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 1.8, { align: 'right' });
}

// ── Capture a DOM section as an image and add to PDF ─────────────────────────
async function addSectionImage(
  pdf: jsPDF,
  el: Element,
  x: number, y: number, maxW: number, maxH: number,
): Promise<number> {
  const canvas = await html2canvas(el as HTMLElement, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
    allowTaint: true,
  });

  const imgData = canvas.toDataURL('image/png');
  const srcW = canvas.width;
  const srcH = canvas.height;
  const ratio = Math.min(maxW / (srcW / 2), maxH / (srcH / 2));
  const drawW = (srcW / 2) * ratio;
  const drawH = (srcH / 2) * ratio;

  pdf.addImage(imgData, 'PNG', x, y, drawW, drawH);
  return drawH;
}

// ── Main export function ──────────────────────────────────────────────────────
export async function exportAnalyticsPDF(
  containerEl: HTMLElement,
  kpis: KPI[],
  reportDate: string,
  onProgress?: (pct: number) => void,
) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let page = 1;
  // We'll fill in total pages at the end — track drawn pages
  const pageCount = () => pdf.getNumberOfPages();

  // ── PAGE 1: Cover summary + KPI grid ─────────────────────────────────────
  drawPageChrome(pdf, page, 1, reportDate); // placeholder total

  // Title block
  const titleY = 12;
  setFill(pdf, COLOR_ACCENT);
  pdf.rect(MARGIN, titleY, 5, 16, 'F');
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  setTextColor(pdf, COLOR_DARK);
  pdf.text('ER Analytics & Insights', MARGIN + 8, titleY + 7);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  setTextColor(pdf, COLOR_MID);
  pdf.text('Live clinical governance and performance metrics', MARGIN + 8, titleY + 13);

  onProgress?.(10);

  // KPI grid — 4 columns
  const kpiCols = 4;
  const kpiW = (CONTENT_W) / kpiCols - 2;
  const kpiH = 16;
  const kpiStartY = titleY + 20;
  const rows = Math.ceil(kpis.length / kpiCols);

  kpis.forEach((kpi, i) => {
    const col = i % kpiCols;
    const row = Math.floor(i / kpiCols);
    drawKPICard(
      pdf, kpi,
      MARGIN + col * (kpiW + 2),
      kpiStartY + row * (kpiH + 2),
      kpiW, kpiH,
    );
  });

  const afterKPI = kpiStartY + rows * (kpiH + 2) + 4;

  onProgress?.(20);

  // Key stats table (2 columns side by side)
  drawSectionHeader(pdf, 'Key Performance Summary', afterKPI);
  const tblY = afterKPI + 8;
  const tblColW = CONTENT_W / 2 - 2;

  const leftStats = kpis.slice(0, Math.ceil(kpis.length / 2)).map(k => ({
    label: k.label,
    value: String(k.value),
    color: k.color,
  }));
  const rightStats = kpis.slice(Math.ceil(kpis.length / 2)).map(k => ({
    label: k.label,
    value: String(k.value),
    color: k.color,
  }));

  drawStatTable(pdf, leftStats, MARGIN, tblY, tblColW);
  drawStatTable(pdf, rightStats, MARGIN + tblColW + 4, tblY, tblColW);

  onProgress?.(30);

  // ── PAGE 2+: Chart sections ───────────────────────────────────────────────
  // Gather all analytics-row and atp-grid elements in order
  const chartSections = Array.from(
    containerEl.querySelectorAll(
      '.analytics-row, .analytics-teaching-panel',
    ),
  );

  const contentStartY = 10; // below top bar
  const contentEndY = PAGE_H - 8; // above bottom bar
  let curY = contentStartY;

  for (let si = 0; si < chartSections.length; si++) {
    const section = chartSections[si];

    // Get a heading from the card's h3 if present
    const h3 = section.querySelector('h3');
    const heading = h3?.textContent?.replace(/^[^\w]+/, '').trim() ?? '';

    // Measure section height on screen to decide if it needs a new page
    const sectionPxH = (section as HTMLElement).offsetHeight;
    const sectionMmH = Math.min((sectionPxH / window.devicePixelRatio) * 0.265, CONTENT_H - 16);

    // If section doesn't fit, add a new page
    if (curY + sectionMmH + 8 > contentEndY || si === 0) {
      if (si > 0) {
        page++;
        pdf.addPage();
      } else {
        page++;
        pdf.addPage();
      }
      drawPageChrome(pdf, page, 1, reportDate);
      curY = contentStartY + 2;
    }

    // Section header bar
    if (heading) {
      drawSectionHeader(pdf, heading, curY);
      curY += 8;
    }

    // Capture section as image
    try {
      const drawnH = await addSectionImage(
        pdf, section,
        MARGIN, curY,
        CONTENT_W, contentEndY - curY - 2,
      );
      curY += drawnH + 5;
    } catch {
      // skip section if capture fails
    }

    onProgress?.(30 + Math.round((si / chartSections.length) * 65));
  }

  onProgress?.(98);

  // ── Fix up page numbers now we know the total ─────────────────────────────
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    drawPageChrome(pdf, p, total, reportDate);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
    const fileName = `MediQGH_ER_Report_${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  pdf.save(fileName);

  onProgress?.(100);
}
