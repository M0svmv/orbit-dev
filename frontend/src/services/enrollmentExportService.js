import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const addHtmlTableToPdf = async (doc, buildTableEl, title) => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const headerH = 18;
    const usableW = pageW - marginX * 2;
    const usableH = pageH - headerH - 10;

    const drawPageHeader = (label) => {
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, pageW, headerH, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(label, marginX, 12);
    };

    doc.addPage("l");
    drawPageHeader(title);

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-99999px";
    container.style.top = "0";
    container.style.width = "1600px";
    container.style.background = "#ffffff";
    container.appendChild(buildTableEl());
    document.body.appendChild(container);

    let canvas;
    try {
        canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
    } finally {
        document.body.removeChild(container);
    }

    const pxToMm = usableW / canvas.width;
    const imgHmm = canvas.height * pxToMm;

    let renderedMm = 0;
    let firstPage = true;
    while (renderedMm < imgHmm) {
        if (!firstPage) {
            doc.addPage("l");
            drawPageHeader(`${title} (cont.)`);
        }
        const sliceHmm = Math.min(usableH, imgHmm - renderedMm);
        const sliceHpx = Math.max(1, Math.round(sliceHmm / pxToMm));
        const srcYpx = Math.round(renderedMm / pxToMm);

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHpx;
        const ctx = sliceCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, srcYpx, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);

        doc.addImage(sliceCanvas.toDataURL("image/png"), "PNG", marginX, headerH + 4, usableW, sliceHmm);

        renderedMm += sliceHmm;
        firstPage = false;
    }
};

const buildDetailTable = (tableColumn, tableRows, statusColor, hintColor) => {
    const table = document.createElement("table");
    table.style.cssText = "border-collapse:collapse;width:100%;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:14px;";

    const colWidths = ["4%", "24%", "10%", "15%", "15%", "10%", "8%", "8%", "10%"];
    const colgroup = document.createElement("colgroup");
    colWidths.forEach(w => {
        const col = document.createElement("col");
        col.style.width = w;
        colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    tableColumn.forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        th.style.cssText = "background:#2563eb;color:#fff;padding:10px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:700;";
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    tableRows.forEach((row, i) => {
        const tr = document.createElement("tr");
        tr.style.background = i % 2 === 0 ? "#ffffff" : "#f8fafc";
        row.forEach((cell, ci) => {
            const td = document.createElement("td");
            td.textContent = cell;
            td.setAttribute("dir", "auto"); // lets Arabic names render RTL, English/numbers stay LTR
            let color = "#0f172a";
            let weight = "400";
            if (ci === 5) { color = statusColor(cell); weight = "700"; }
            if (ci === 8) { color = hintColor(cell); weight = "600"; }
            td.style.cssText = `padding:7px 8px;border:1px solid #e2e8f0;text-align:center;color:${color};font-weight:${weight};`;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
};

const buildStaffLoadTable = (staffLoad) => {
    const table = document.createElement("table");
    table.style.cssText = "border-collapse:collapse;width:100%;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:14px;";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Instructor", "Courses Assigned", "Total Students", "Load Level"].forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        th.style.cssText = "background:#2563eb;color:#fff;padding:10px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:700;";
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    staffLoad.forEach((s, i) => {
        const tr = document.createElement("tr");
        tr.style.background = i % 2 === 0 ? "#ffffff" : "#f8fafc";
        const load = s.courses >= 4 ? "High" : s.courses >= 2 ? "Medium" : "Low";
        [s.name, s.courses, s.students, load].forEach((cell, ci) => {
            const td = document.createElement("td");
            td.textContent = cell;
            if (ci === 0) td.setAttribute("dir", "auto");
            td.style.cssText = "padding:7px 8px;border:1px solid #e2e8f0;text-align:center;color:#0f172a;";
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
};

const buildExportRows = (filteredData) =>
    [...filteredData]
        .sort((a, b) => (b.enrolledCount || 0) - (a.enrolledCount || 0))
        .map((off, idx) => [
            idx + 1,
            off.courseId?.courseName || "N/A",
            off.courseId?._id || "N/A",
            off.instructorId?.staffName || "-",
            off.taId?.staffName || "-",
            (off.status || "N/A").toUpperCase(),
            off.enrolledCount || 0,
            off.graduatingCount || 0,
            (off.enrolledCount || 0) < 20 && (off.status === "open" || off.status === "proposed") && (off.graduatingCount || 0) === 0
                ? "Low Demand"
                : (off.graduatingCount || 0) > 0
                    ? "Mandatory"
                    : "Normal",
        ]);

// ─── Export PDF ───────────────────────────────────────────────────────────
export const exportEnrollmentPDF = async ({ semesterId, typeFilter, filteredData, offerings, stats, chartData, enrolledCount }) => {
    const doc = new jsPDF("l", "mm", "a4"); 
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // ── Cover / Header ──────────────────────────────────────────────────
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 38, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Enrollment Statistics Report", 14, 16);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`Semester: ${semesterId}  |  Generated: ${now}  |  Filter: ${typeFilter}`, 14, 25);
    doc.text(`Total Offerings Shown: ${filteredData.length} / ${offerings.length}`, 14, 32);

    // ── KPI Summary Cards ───────────────────────────────────────────────
    const kpis = [
        { label: "Total Offerings", value: stats.total, color: [37, 99, 235] },
        { label: "Open Courses", value: stats.open, color: [16, 185, 129] },
        { label: "Closed Courses", value: stats.closed, color: [239, 68, 68] },
        { label: "Proposed Courses", value: stats.proposed, color: [245, 158, 11] },
        { label: "Total Students", value: enrolledCount, color: [37, 99, 235] },
        { label: "Empty Courses", value: stats.empty, color: [245, 158, 11] },
        { label: "Avg Enrollment", value: stats.avgEnrollment, color: [139, 92, 246] },
        { label: "Grad Critical", value: stats.withGrads, color: [16, 185, 129] },
        { label: "Suggestions", value: stats.suggestions, color: [239, 68, 68] },
    ];
    const cols = 4;
    const cardW = (pageW - 28) / cols;
    kpis.forEach((kpi, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 14 + col * cardW;
        const y = 44 + row * 22;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, cardW - 4, 19, 2, 2, "F");
        doc.setDrawColor(...kpi.color);
        doc.setLineWidth(0.8);
        doc.roundedRect(x, y, cardW - 4, 19, 2, 2, "S");
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...kpi.color);
        doc.text(String(kpi.value), x + 6, y + 12);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, x + 6, y + 17);
    });

    const kpiRows = Math.ceil(kpis.length / cols);
    const chartY = 44 + kpiRows * 22 + 12;

    // ── Chart: Enrollment Distribution (bar via rectangles) ─────────────
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Enrollment Distribution by Range", 14, chartY);

    const distData = chartData.distributionBar;
    const maxVal = Math.max(...distData.map(d => d.Courses), 1);
    const barAreaW = 120;
    const barH = 8;
    const barStartX = 50;
    const barStartY = chartY + 6;

    distData.forEach((d, i) => {
        const y = barStartY + i * 11;
        const barW = (d.Courses / maxVal) * barAreaW;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(d.range, 14, y + 6);
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(barStartX, y, barAreaW, barH, 2, 2, "F");
        if (barW > 0) {
            doc.setFillColor(37, 99, 235);
            doc.roundedRect(barStartX, y, barW, barH, 2, 2, "F");
        }
        doc.setTextColor(37, 99, 235);
        doc.setFont("helvetica", "bold");
        doc.text(String(d.Courses), barStartX + barAreaW + 4, y + 6);
    });

    // ── Chart: Status Breakdown (Open / Closed / Proposed) ──────────
    const statusX = 190;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Course Status Breakdown", statusX, chartY);

    const pieData = [
        { label: "Open", value: stats.open, color: [16, 185, 129] },
        { label: "Closed", value: stats.closed, color: [239, 68, 68] },
        { label: "Proposed", value: stats.proposed, color: [245, 158, 11] },
    ];
    pieData.forEach((seg, i) => {
        const lx = statusX;
        const ly = chartY + 8 + i * 12;
        doc.setFillColor(...seg.color);
        doc.roundedRect(lx, ly, 8, 8, 1, 1, "F");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...seg.color);
        doc.text(`${seg.value}`, lx + 10, ly + 6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(seg.label, lx + 20, ly + 6);
    });

    // ── Main Data Table (rendered as real HTML -> image, so Arabic renders correctly) ─
    const statusColor = (val) => val === "OPEN" ? "#10b981" : val === "CLOSED" ? "#ef4444" : "#f59e0b";
    const hintColor = (val) => val.includes("Low") ? "#f59e0b" : val.includes("Mandatory") ? "#10b981" : "#64748b";

    const tableColumn = ["#", "Course Name", "Code", "Instructor", "TA", "Status", "Students", "Graduating", "System Hint"];
    const tableRows = buildExportRows(filteredData);

    await addHtmlTableToPdf(
        doc,
        () => buildDetailTable(tableColumn, tableRows, statusColor, hintColor),
        "Course Offerings Detail"
    );

    // ── Staff Load Page (also rendered as HTML -> image, instructor names may be Arabic too) ─
    if (chartData.staffLoad.length > 0) {
        await addHtmlTableToPdf(
            doc,
            () => buildStaffLoadTable(chartData.staffLoad),
            "Instructor Load Analysis"
        );
    }

    // ── Footer on all pages ─────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
            `Page ${p} of ${totalPages}  |  Enrollment Report — Semester ${semesterId}  |  ${now}`,
            14, pageH - 6
        );
    }

    doc.save(`Enrollment_Report_${semesterId}.pdf`);
};

// ─── Export CSV ───────────────────────────────────────────────────────────
export const exportEnrollmentCSV = ({ filteredData, semesterId }) => {
    const headers = ["#", "Course Name", "Code", "Instructor", "TA", "Status", "Students", "Graduating", "System Hint"];
    const rows = buildExportRows(filteredData);


    const escapeCsvCell = (val) => {
        const str = String(val ?? "");
        if (/[",\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvLines = [headers, ...rows].map(row => row.map(escapeCsvCell).join(","));
    // Leading BOM so Excel opens the file with correct Arabic encoding instead of garbled text.
    const csvContent = "\uFEFF" + csvLines.join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Enrollment_Report_${semesterId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};