import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─────────────────────────────────────────────────────────────────────────────
// Arabic-safe text helpers
// ─────────────────────────────────────────────────────────────────────────────
export const arabicTextToImage = (text, { fontSize = 13, color = "#1e293b", maxWidth = 400 } = {}) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const dpr = 2;
    const font = `${fontSize * dpr}px "Segoe UI", "Noto Sans Arabic", Arial, sans-serif`;

    ctx.font = font;

    const words = text.split(" ");
    const lines = [];
    let line = "";
    words.forEach(word => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth * dpr && line) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    });
    if (line) lines.push(line);

    const lineH = fontSize * dpr * 1.5;
    canvas.width = maxWidth * dpr;
    canvas.height = lines.length * lineH + 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.direction = "rtl";
    ctx.textAlign = "right";

    lines.forEach((ln, i) => {
        ctx.fillText(ln, canvas.width - 4, (i + 1) * lineH - fontSize * dpr * 0.3);
    });

    return {
        dataUrl: canvas.toDataURL("image/png"),
       
        widthMm: (canvas.width / dpr) * 0.264583,
        heightMm: (canvas.height / dpr) * 0.264583,
    };
};

export const hasArabic = (str = "") => /[\u0600-\u06FF]/.test(str);

export const drawMixedText = (doc, text, x, y, { fontSize = 10, color = [30, 41, 59], maxWidthMm = 160 } = {}) => {
    if (!text) return y;
    const str = String(text);
    if (hasArabic(str)) {
        const img = arabicTextToImage(str, {
            fontSize: fontSize + 1,
            color: `rgb(${color.join(",")})`,
            maxWidth: maxWidthMm / 0.264583,
        });
        doc.addImage(img.dataUrl, "PNG", x, y - fontSize * 0.4, img.widthMm, img.heightMm);
        return y + img.heightMm + 1;
    } else {
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(str, maxWidthMm);
        doc.text(lines, x, y);
        return y + lines.length * (fontSize * 0.4);
    }
};

// Safely turn a course reference (string id OR populated object) into a display name
export const courseLabel = (c) => {
    if (!c) return "";
    if (typeof c === "string") return c;
    return c.courseName || c.name || c._id || "Unknown Course";
};

// Safely turn an advisor reference into { name, id, unassigned }.
// Handles 3 cases: no advisor at all (unassigned), a plain string ID
// (e.g. the advisor viewing their own requests — backend doesn't populate them
// with their own name), or a populated object with staffName.
export const getAdvisorInfo = (advisorRef) => {
    if (!advisorRef) return { name: null, id: null, unassigned: true };
    if (typeof advisorRef === "string") return { name: null, id: advisorRef, unassigned: false };
    return {
        name: advisorRef.staffName || null,
        id: advisorRef._id || advisorRef.id || null,
        unassigned: false,
    };
};

// Same idea but returns a single display string, for table cells.
export const advisorLabel = (advisorRef) => {
    const info = getAdvisorInfo(advisorRef);
    if (info.unassigned) return "Unassigned";
    return info.name || (info.id ? `ID: ${info.id}` : "Unassigned");
};

// ─────────────────────────────────────────────────────────────────────────────
// 1) Per-request detailed PDF export (no emoji — colored dot accent instead)
// ─────────────────────────────────────────────────────────────────────────────
export const exportRequestPDF = (req) => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const margin = 14;

    // ── Header bar ──────────────────────────────────────────────────────────
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 38, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Academic Request Report", margin, 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${now}`, margin, 22);
    doc.text(`Request ID: ${req._id}`, margin, 29);

    // Status pill (top-right)
    const statusColors = {
        pending: [245, 158, 11],
        approved: [16, 185, 129],
        rejected: [239, 68, 68],
    };
    const sColor = statusColors[req.status] || [100, 116, 139];
    doc.setFillColor(...sColor);
    doc.roundedRect(pageW - 50, 10, 36, 12, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text((req.status || "").toUpperCase(), pageW - 32, 18, { align: "center" });

    // ── Helpers ─────────────────────────────────────────────────────────────
    let y = 48;

    // Section title — colored filled-circle accent + bold text, NO emoji
    const SECTION_COLORS = {
        "Student Information": [59, 130, 246],   // blue
        "Request Details": [99, 102, 241],   // indigo
        "Student Justification": [245, 158, 11],   // amber
        "Academic Advisor": [16, 185, 129],   // emerald
    };

    const sectionTitle = (title) => {
        const accentColor = SECTION_COLORS[title] || [59, 130, 246];

        // light tinted background bar
        doc.setFillColor(240, 245, 255);
        doc.roundedRect(margin, y, pageW - margin * 2, 9, 2, 2, "F");

        // colored accent dot
        doc.setFillColor(...accentColor);
        doc.circle(margin + 5, y + 4.5, 2.2, "F");

        // title text
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...accentColor);
        doc.text(title, margin + 10, y + 6.5);

        y += 14;
    };

    const fieldLabel = (label) => {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(label, margin, y);
        y += 4;
    };

    const fieldValue = (value, opts = {}) => {
        const newY = drawMixedText(doc, value || "N/A", margin, y, {
            fontSize: 10,
            color: opts.color || [30, 41, 59],
            maxWidthMm: pageW - margin * 2,
        });
        y = newY + 5;
    };

    // Two-column layout — fixed row tracking
    const twoCol = (items) => {
        const colW = (pageW - margin * 2) / 2;
        // Render pairs row by row
        for (let r = 0; r < items.length; r += 2) {
            const rowItems = items.slice(r, r + 2);
            const rowStartY = y;
            let rowMaxY = rowStartY;

            rowItems.forEach((item, col) => {
                const cx = margin + col * colW;
                let cy = rowStartY;

                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 116, 139);
                doc.text(item.label, cx, cy);
                cy += 4;

                const endY = drawMixedText(doc, item.value || "N/A", cx, cy, {
                    fontSize: 10,
                    color: item.color || [30, 41, 59],
                    maxWidthMm: colW - 6,
                });
                rowMaxY = Math.max(rowMaxY, endY + 3);
            });

            y = rowMaxY + 4;
        }
    };

    const divider = () => {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(margin, y, pageW - margin, y);
        y += 6;
    };

    // ── 1. Student Info ─────────────────────────────────────────────────────
    sectionTitle("Student Information");
    twoCol([
        { label: "Student Name", value: req.studentId?.studentName },
        { label: "Student ID", value: req.studentId?._id || req.studentId?.id },
        {
            label: "Semester",
            value: req.semesterId?.name || req.semesterId,
        },
        {
            label: "Submitted On",
            value: new Date(req.createdAt).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
            }),
        },
    ]);
    divider();

    // ── 2. Request Details ──────────────────────────────────────────────────
    sectionTitle("Request Details");
    twoCol([
        { label: "Request Type", value: req.requestType },
        { label: "Status", value: (req.status || "").toUpperCase(), color: sColor },
    ]);

    if (req.requestType === "Withdrawal" || req.requestType === "improve Grade") {
        fieldLabel("Target Course");
        const cname = courseLabel(req.courseId) || "N/A";
        const cid = req.courseId?._id ? ` (${req.courseId._id})` : "";
        fieldValue(cname + cid, { color: [37, 99, 235] });
    }

    if (req.requestType === "Add Drop" || req.requestType === "Overload") {
        fieldLabel("Added Courses");
        if (req.addedCourses?.length > 0) {
            req.addedCourses.forEach(c => {
                fieldValue(`+ ${courseLabel(c)}${c?._id ? ` (${c._id})` : ""}`, { color: [16, 185, 129] });
            });
        } else {
            fieldValue("None");
        }

        fieldLabel("Dropped Courses");
        if (req.droppedCourses?.length > 0) {
            req.droppedCourses.forEach(c => {
                fieldValue(`- ${courseLabel(c)}${c?._id ? ` (${c._id})` : ""}`, { color: [239, 68, 68] });
            });
        } else {
            fieldValue("None");
        }
    }

    divider();

    // ── 3. Student Justification ────────────────────────────────────────────
    sectionTitle("Student Justification");

    const reason = req.writtenReason || req.studentSuggestion || "No explanation provided.";
    const boxStartY = y;

    // Measure text height first
    const tempEndY = drawMixedText(doc, `"${reason}"`, margin + 4, y + 4, {
        fontSize: 10,
        color: [30, 41, 59],
        maxWidthMm: pageW - margin * 2 - 8,
    });
    const actualBoxH = Math.max(tempEndY - boxStartY + 4, 18);

    // Draw box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, boxStartY, pageW - margin * 2, actualBoxH, 3, 3, "FD");

    // Draw text on top
    drawMixedText(doc, `"${reason}"`, margin + 4, boxStartY + 4, {
        fontSize: 10,
        color: [30, 41, 59],
        maxWidthMm: pageW - margin * 2 - 8,
    });

    y = boxStartY + actualBoxH + 8;

    if (req.withdrawalReason) {
        fieldLabel("Withdrawal Category");
        fieldValue(req.withdrawalReason);
    }

    divider();

    // ── 4. Academic Advisor ─────────────────────────────────────────────────
    sectionTitle("Academic Advisor");
    {
        const advisorInfo = getAdvisorInfo(req.academicAdvisorId);
        if (advisorInfo.unassigned) {
            twoCol([{ label: "Advisor Name", value: "Not Assigned" }]);
        } else {
            const advisorItems = [];
            if (advisorInfo.name) advisorItems.push({ label: "Advisor Name", value: advisorInfo.name });
            advisorItems.push({ label: "Advisor ID", value: advisorInfo.id || "—" });
            twoCol(advisorItems);
        }
    }

    fieldLabel("Advisor Comment");
    const comment = req.academicAdvisorComment || "No comment from advisor yet.";
    const commentStartY = y;

    const tempCommentEndY = drawMixedText(doc, comment, margin + 4, y + 4, {
        fontSize: 10,
        color: [30, 64, 175],
        maxWidthMm: pageW - margin * 2 - 8,
    });
    const commentBoxH = Math.max(tempCommentEndY - commentStartY + 4, 14);

    doc.setFillColor(240, 249, 255);
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, commentStartY, pageW - margin * 2, commentBoxH, 3, 3, "FD");

    drawMixedText(doc, comment, margin + 4, commentStartY + 4, {
        fontSize: 10,
        color: [30, 64, 175],
        maxWidthMm: pageW - margin * 2 - 8,
    });

    y = commentStartY + commentBoxH + 6;

    // ── Footer ──────────────────────────────────────────────────────────────
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
        `Academic Request Report  |  ${now}  |  Page 1 of 1`,
        pageW / 2, pageH - 6, { align: "center" }
    );

    const studentName = req.studentId?.studentName || "student";
    const safeName = studentName.replace(/[^\w\s\u0600-\u06FF]/g, "").trim().replace(/\s+/g, "_");
    doc.save(`Request_${req.requestType}_${safeName}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 2) Multi-request summary PDF export (table view) — Arabic-safe
// ─────────────────────────────────────────────────────────────────────────────
export const exportRequestsSummaryPDF = (requests) => {
    const doc = new jsPDF();
    const now = new Date();

    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("Academic Requests Summary Report", 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${now.toLocaleString()}`, 14, 28);
    doc.text(`Total Requests: ${requests.length}`, 14, 34);

    const getDetails = (req) => {
        if (req.requestType === 'Add Drop') {
            const added = req.addedCourses?.length ? req.addedCourses.map(courseLabel).join(', ') : '-';
            const dropped = req.droppedCourses?.length ? req.droppedCourses.map(courseLabel).join(', ') : '-';
            return `Add: ${added} | Drop: ${dropped}`;
        }
        if (req.requestType === 'Withdrawal' || req.requestType === 'improve Grade') {
            return `Course: ${courseLabel(req.courseId) || 'N/A'}`;
        }
        if (req.requestType === 'Overload') {
            return `Courses: ${req.addedCourses?.length ? req.addedCourses.map(courseLabel).join(', ') : 'N/A'}`;
        }
        return courseLabel(req.courseId) || 'N/A';
    };

    const tableColumn = ["Student Name", "ID", "Type", "Details", "Advisor", "Date", "Status"];
    const tableRows = requests.map(req => ([
        req.studentId?.studentName || "N/A",
        req.studentId?._id || req.studentId?.id || "N/A",
        req.requestType || "N/A",
        getDetails(req),
        advisorLabel(req.academicAdvisorId),
        req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "N/A",
        (req.status || "").toUpperCase(),
    ]));

    const arabicCellImages = {};
    tableRows.forEach((row, rIdx) => {
        row.forEach((cell, cIdx) => {
            const text = String(cell ?? "");
            if (hasArabic(text)) {
                arabicCellImages[`${rIdx}-${cIdx}`] = arabicTextToImage(text, {
                    fontSize: 9,
                    color: "#1e293b",
                    maxWidth: 70,
                });
                row[cIdx] = "";
            }
        });
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },

        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawCell: (data) => {
            if (data.section !== 'body') return;
            const img = arabicCellImages[`${data.row.index}-${data.column.index}`];
            if (!img) return;

            const maxW = data.cell.width - 4;
            const maxH = data.cell.height - 2;
            let w = img.widthMm;
            let h = img.heightMm;

            if (w > maxW) {
                const ratio = maxW / w;
                w *= ratio;
                h *= ratio;
            }
            if (h > maxH) {
                const ratio = maxH / h;
                h *= ratio;
                w *= ratio;
            }

            const x = data.cell.x + data.cell.width - w - 2; // right-align (Arabic/RTL)
            const y = data.cell.y + (data.cell.height - h) / 2;
            doc.addImage(img.dataUrl, "PNG", x, y, w, h);
        },
    });

    doc.save(`Academic_Requests_Report_${Date.now()}.pdf`);
};