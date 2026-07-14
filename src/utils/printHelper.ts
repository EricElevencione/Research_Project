export interface PrintReportOptions {
  title: string;
  reportName: string;
  filterLabel: string;
  totalCount: number;
  tableHeaderHtml: string;
  tableBodyHtml: string;
  printedBy: string;
}

/**
 * Standardized utility to print RSBSA reports.
 * Centered header layout conforms to Department of Agriculture standards.
 */
export const printHtmlReport = (options: PrintReportOptions) => {
  const {
    title,
    reportName,
    filterLabel,
    totalCount,
    tableHeaderHtml,
    tableBodyHtml,
    printedBy,
  } = options;

  const w = window.open("", "_blank");
  if (!w) return;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page {
      size: auto;
      margin: 0mm;
    }
    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 9px;
      margin: 0;
      padding: 12mm;
      color: #1e293b;
      line-height: 1.4;
    }
    .hdr { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 8px; margin-bottom: 12px; }
    .main-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }
    .dept-title { font-size: 11px; font-weight: 700; color: #1e3a8a; }
    .agency-title { font-size: 9px; font-weight: 600; color: #475569; margin: 1px 0; }
    .report-title { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .sub-title { font-size: 10px; font-weight: 600; color: #64748b; }
    .meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 8px; color: #64748b; font-weight: 500; }
    .meta span { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 8px; margin-top: 5px; }
    th { background: #059669; color: #fff; padding: 4px 6px; text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: .5px solid #e2e8f0; }
    td { padding: 3px 6px; border: .5px solid #e2e8f0; vertical-align: top; color: #334155; }
    tr:nth-child(even) td { background: #f8fafc; }
    .ftr { margin-top: 15px; font-size: 8px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; }
  </style>
</head>
<body>
  <div class="hdr">
    <div class="main-title">Republic of the Philippines</div>
    <div class="dept-title">Department of Agriculture</div>
    <div class="agency-title">Registry System for Basic Sectors in Agriculture (RSBSA)</div>
    <div class="report-title">${reportName}</div>
    <div class="sub-title">Municipality of Dumangas, Iloilo</div>
  </div>
  <div class="meta">
    <span>Filter: ${filterLabel}</span>
    <span>Total: ${totalCount} records</span>
    <span>Printed: ${new Date().toLocaleString()}</span>
  </div>
  <table>
    <thead>
      <tr>${tableHeaderHtml}</tr>
    </thead>
    <tbody>
      ${tableBodyHtml}
    </tbody>
  </table>
  <div class="ftr">
    RSBSA ${reportName} — Dumangas, Iloilo · Printed by ${printedBy} · ${new Date().toLocaleDateString()}
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
};
