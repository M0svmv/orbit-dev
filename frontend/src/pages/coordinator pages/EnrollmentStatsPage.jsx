import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import swalService from "../../services/swal";
import { exportEnrollmentPDF, exportEnrollmentCSV } from "../../services/enrollmentExportService";
import {
    ArrowLeft, Users, Search, Lock, Unlock, Clock,
    GraduationCap, BookOpen, AlertCircle, CheckCircle2,
    FileText, FileSpreadsheet, UserSquare2, Loader2, BarChart2, TrendingUp,
    ChevronDown
} from "lucide-react";
import { FaArrowLeft } from "react-icons/fa";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, ResponsiveContainer
} from "recharts";

import "../styles/EnrollmentStatusPage.css";

// ─── Color palette ────────────────────────────────────────────────────────────
const CHART_COLORS = {
    primary: "#2563eb",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    purple: "#8b5cf6",
    slate: "#64748b",
};

// ─── Status configuration (single source of truth for colors / icons / labels) ─
const STATUS_CONFIG = {
    open: { label: "Open", color: CHART_COLORS.success, bg: "#10b98120", icon: Unlock },
    closed: { label: "Closed", color: CHART_COLORS.danger, bg: "#ef444420", icon: Lock },
    proposed: { label: "Proposed", color: CHART_COLORS.warning, bg: "#f59e0b20", icon: Clock },
};
const getStatusCfg = (status) => STATUS_CONFIG[status] || { label: status || "N/A", color: "#64748b", bg: "#64748b20", icon: AlertCircle };

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const fullLabel = payload[0]?.payload?.fullName || label;
    return (
        <div style={{
            background: "#1e293b", border: "1px solid #334155",
            borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13,
            maxWidth: 240
        }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{fullLabel}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, margin: "2px 0" }}>
                    {p.name}: <strong>{p.value}</strong>
                </p>
            ))}
        </div>
    );
};

const CustomPieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: "#1e293b", border: "1px solid #334155",
            borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13
        }}>
            <p style={{ fontWeight: 600 }}>{payload[0].name}</p>
            <p style={{ color: payload[0].payload.fill }}>Count: <strong>{payload[0].value}</strong></p>
        </div>
    );
};

// ─── Section header for charts ─────────────────────────────────────────────────
const SectionTitle = ({ icon: Icon, title, subtitle }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg,#2563eb22,#2563eb44)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>
            <Icon size={16} color="#2563eb" />
        </div>
        <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11.5, color: "#64748b" }}>{subtitle}</div>}
        </div>
    </div>
);

// ─── Chart wrapper card ────────────────────────────────────────────────────────
const ChartCard = ({ children, style }) => (
    <div style={{
        background: "#fff",
        borderRadius: 14,
        padding: "16px 18px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 12px #0f172a0a",
        minWidth: 0,
        ...style
    }}>
        {children}
    </div>
);

// ─── Status badge (colored per status, not just open/closed) ──────────────────
const StatusBadge = ({ status }) => {
    const cfg = getStatusCfg(status);
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 20,
            fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3,
            background: cfg.bg, color: cfg.color,
        }}>
            {cfg.label.toUpperCase()}
        </span>
    );
};

// ─── Status action buttons (Open / Close / Proposed) ──────────────────────────
const StatusActions = ({ current, onChange }) => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const active = current === key;
            return (
                <button
                    key={key}
                    type="button"
                    title={cfg.label}
                    disabled={active}
                    onClick={() => onChange(key)}
                    style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: 8,
                        border: `1.5px solid ${cfg.color}`,
                        background: active ? cfg.color : "#fff",
                        color: active ? "#fff" : cfg.color,
                        cursor: active ? "default" : "pointer",
                        opacity: active ? 1 : 0.9,
                        transition: "all .15s ease",
                    }}
                >
                    <Icon size={10} />
                </button>
            );
        })}
    </div>
);

// ─── Export dropdown button (PDF / CSV in one place) ───────────────────────────
const dropdownItemStyle = {
    display: "flex", alignItems: "center", gap: 8,
    width: "100%", padding: "10px 14px", background: "none", border: "none",
    fontSize: 13.5, fontWeight: 500, color: "#0f172a", cursor: "pointer", textAlign: "left"
};

const ExportMenu = ({ onExportPDF, onExportCSV, exporting }) => {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={menuRef} style={{ position: "relative" }}>
            <button
                className="btn-2"
                onClick={() => setOpen(v => !v)}
                disabled={exporting}
                style={{ display: "flex", alignItems: "center", gap: 8, opacity: exporting ? 0.7 : 1 }}
            >
                {exporting ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <FileText size={18} />}
                {exporting ? "Generating..." : "Export"}
                <ChevronDown size={14} />
            </button>
            {open && (
                <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0,
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                    boxShadow: "0 8px 24px #0f172a1f", overflow: "hidden", zIndex: 30, minWidth: 180
                }}>
                    <button
                        style={dropdownItemStyle}
                        onMouseDown={() => { setOpen(false); onExportPDF(); }}
                    >
                        <FileText size={16} color="#ef4444" /> PDF Report
                    </button>
                    <div style={{ height: 1, background: "#f1f5f9" }} />
                    <button
                        style={dropdownItemStyle}
                        onMouseDown={() => { setOpen(false); onExportCSV(); }}
                    >
                        <FileSpreadsheet size={16} color="#0f766e" /> CSV File
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const EnrollmentStatsPage = () => {
    const { semesterId } = useParams();
    const navigate = useNavigate();
    const { role } = useParams();

    const [offerings, setOfferings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState("All");
    const [regulationFilter, setRegulationFilter] = useState("All");
    const [showCharts, setShowCharts] = useState(true);
    const [enrolledCount, setEnrolledCount] = useState(0);
    const [exporting, setExporting] = useState(false);

    // ─── Navigation ──────────────────────────────────────────────────────────
    const handleViewStudents = (courseId, offeringId, courseName, instructorId, taId) => {
        navigate(`/staff/${role}/semester/${semesterId}/course/${courseId}/${offeringId}/students`, {
            state: { courseName, instructorId, taId }
        });
    };

    // ─── Fetch ────────────────────────────────────────────────────────────────
    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/course-offerings?semesterId=${semesterId}`);
            const payload = res.data;
            const list = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.courseOfferings)
                    ? payload.courseOfferings
                    : [];
            const totalStudents = Array.isArray(payload)
                ? list.reduce((sum, o) => sum + (o.enrolledCount || 0), 0)
                : (payload?.totalStudents ?? list.reduce((sum, o) => sum + (o.enrolledCount || 0), 0));

            setOfferings(list);
            setEnrolledCount(totalStudents);
        } catch (err) {
            console.error("Failed to fetch stats", err);
            swalService.error("Connection Error", "Could not load enrollment data.");
            setOfferings([]);
            setEnrolledCount(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (semesterId) fetchData(); }, [semesterId]);

    // ─── Change status (Open / Closed / Proposed) ─────────────────────────────
    const handleStatusChange = async (offeringId, newStatus) => {
        const offering = offerings.find(o => o._id === offeringId);
        if (!offering || offering.status === newStatus) return;
        const currentEnrolledCount = offering.enrolledCount || 0;

        if (newStatus === "closed") {
            let title = "Close Course?";
            let text = "Are you sure you want to CLOSE this course? This will prevent any future enrollments.";
            if (currentEnrolledCount > 0) {
                title = "CRITICAL WARNING";
                text = `This course has (${currentEnrolledCount}) students enrolled. Closing it will PERMANENTLY block their registration!`;
            }
            const result = await swalService.confirm(title, text, "Yes, close it!");
            if (!result.isConfirmed) return;
        }

        if (newStatus === "proposed") {
            const result = await swalService.confirm(
                "Mark as Proposed?",
                "This will mark the course as PROPOSED",
                "Yes, mark as proposed"
            );
            if (!result.isConfirmed) return;
        }

        try {
            swalService.showLoading("Updating course status...");
            await api.put(`/course-offerings/${offeringId}/status`, { status: newStatus });
            setOfferings(prev => prev.map(off =>
                off._id === offeringId ? { ...off, status: newStatus } : off
            ));
            swalService.success("Status Updated", `Course is now ${newStatus.toUpperCase()}`);
        } catch (err) {
            console.error("Failed to update status", err);
            swalService.error("Server Error", "Failed to update course status. Please try again.");
        }
    };

    const handleCardClick = (filterName) => {
        setTypeFilter(prev => prev === filterName ? "All" : filterName);
    };

    // ─── Stats ────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = offerings.length;
        const open = offerings.filter(o => o.status === "open").length;
        const closed = offerings.filter(o => o.status === "closed").length;
        const proposed = offerings.filter(o => o.status === "proposed").length;
        const empty = offerings.filter(o => (o.enrolledCount || 0) === 0).length;
        const withGrads = offerings.filter(o => (o.graduatingCount || 0) > 0).length;
        const suggestions = offerings.filter(o => (o.status === "open" || o.status === "proposed") && (o.enrolledCount || 0) < 20 && (o.graduatingCount || 0) === 0).length;
        const totalStudents = offerings.reduce((sum, o) => sum + (o.enrolledCount || 0), 0);
        const totalGrads = offerings.reduce((sum, o) => sum + (o.graduatingCount || 0), 0);
        const avgEnrollment = total > 0 ? (totalStudents / total).toFixed(1) : 0;
        return { total, open, closed, proposed, empty, withGrads, suggestions, totalStudents, totalGrads, avgEnrollment };
    }, [offerings]);

    // ─── Chart data ───────────────────────────────────────────────────────────
    const chartData = useMemo(() => {
        // Top 10 courses by enrollment
        const topCourses = [...offerings]
            .sort((a, b) => (b.enrolledCount || 0) - (a.enrolledCount || 0))
            .slice(0, 10)
            .map(o => ({
                name: o.courseId?.courseName?.length > 12
                    ? o.courseId.courseName.slice(0, 12) + "…"
                    : (o.courseId?.courseName || "N/A"),
                fullName: o.courseId?.courseName || "N/A",
                Students: o.enrolledCount || 0,
                Graduating: o.graduatingCount || 0,
            }));

        // Status breakdown for pie (now includes Proposed)
        const statusPie = [
            { name: "Open", value: stats.open, fill: STATUS_CONFIG.open.color },
            { name: "Closed", value: stats.closed, fill: STATUS_CONFIG.closed.color },
            { name: "Proposed", value: stats.proposed, fill: STATUS_CONFIG.proposed.color },
        ].filter(d => d.value > 0);

        // Enrollment category breakdown
        const categoryPie = [
            { name: "Normal (20+ students)", value: offerings.filter(o => (o.enrolledCount || 0) >= 20).length, fill: CHART_COLORS.primary },
            { name: "Low Demand (<20, open/proposed)", value: stats.suggestions, fill: CHART_COLORS.warning },
            { name: "Empty (0 students)", value: stats.empty, fill: CHART_COLORS.danger },
            { name: "With Graduates", value: stats.withGrads, fill: CHART_COLORS.success },
        ].filter(d => d.value > 0);

        // Enrollment distribution histogram
        const buckets = { "0": 0, "1-5": 0, "6-10": 0, "11-20": 0, "21-30": 0, "30+": 0 };
        offerings.forEach(o => {
            const n = o.enrolledCount || 0;
            if (n === 0) buckets["0"]++;
            else if (n <= 5) buckets["1-5"]++;
            else if (n <= 10) buckets["6-10"]++;
            else if (n <= 20) buckets["11-20"]++;
            else if (n <= 30) buckets["21-30"]++;
            else buckets["30+"]++;
        });
        const distributionBar = Object.entries(buckets).map(([range, count]) => ({ range, Courses: count }));

        // Staff load
        const staffMap = {};
        offerings.forEach(o => {
            const name = o.instructorId?.staffName;
            if (!name) return;
            if (!staffMap[name]) staffMap[name] = { name, courses: 0, students: 0 };
            staffMap[name].courses++;
            staffMap[name].students += o.enrolledCount || 0;
        });
        const staffLoad = Object.values(staffMap)
            .sort((a, b) => b.students - a.students)
            .slice(0, 8);

        return { topCourses, statusPie, categoryPie, distributionBar, staffLoad };
    }, [offerings, stats]);

    // ─── Regulation filter options (derived from actual data, case-insensitive dedup) ──
    const regulationOptions = useMemo(() => {
        const seen = new Map(); // key: lowercased value, value: original display text (first occurrence)
        offerings.forEach(o => {
            const raw = o.courseId?.courseRegulation;
            if (!raw) return;
            const key = raw.toLowerCase();
            if (!seen.has(key)) seen.set(key, raw);
        });
        return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [offerings]);

    // ─── Filtered table data ──────────────────────────────────────────────────
    const filteredData = useMemo(() => {
        return offerings.filter(off => {
            const courseName = off.courseId?.courseName || "";
            const courseCode = off.courseId?._id || "";
            const currentSearch = searchTerm?.toLowerCase() || "";
            const matchesSearch =
                courseName.toLowerCase().includes(currentSearch) ||
                courseCode.toLowerCase().includes(currentSearch);
            const matchesStatus = statusFilter === "All" || off.status === statusFilter;
            let matchesType = true;
            if (typeFilter === "Graduates") matchesType = (off.graduatingCount || 0) > 0;
            if (typeFilter === "Empty") matchesType = (off.enrolledCount || 0) === 0;
            if (typeFilter === "Suggestions")
                matchesType = (off.status === "open" || off.status === "proposed") && (off.enrolledCount || 0) < 20 && (off.graduatingCount || 0) === 0;
            const matchesRegulation =
                regulationFilter === "All" ||
                (off.courseId?.courseRegulation || "").toLowerCase() === regulationFilter.toLowerCase();
            return matchesSearch && matchesStatus && matchesType && matchesRegulation;
        });
    }, [offerings, searchTerm, statusFilter, typeFilter, regulationFilter]);

    const sortedTableData = useMemo(() => (
        [...filteredData].sort((a, b) => {
            const diff = (b.enrolledCount || 0) - (a.enrolledCount || 0);
            if (diff !== 0) return diff;
            return (a.courseId?.courseName || "").localeCompare(b.courseId?.courseName || "");
        })
    ), [filteredData]);

    // ─── Export handlers (delegate the heavy lifting to the service) ──────────
    const handleExportPDF = async () => {
        try {
            setExporting(true);
            await exportEnrollmentPDF({ semesterId, typeFilter, filteredData, offerings, stats, chartData, enrolledCount });
        } catch (err) {
            console.error("Failed to export PDF", err);
            swalService.error("Export Failed", "Could not generate the PDF report. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    const handleExportCSV = () => {
        try {
            exportEnrollmentCSV({ filteredData, semesterId });
        } catch (err) {
            console.error("Failed to export CSV", err);
            swalService.error("Export Failed", "Could not generate the CSV file. Please try again.");
        }
    };

    // ─── Loading screen ───────────────────────────────────────────────────────
    if (loading) return (
        <div className="management-container" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "80vh", flexDirection: "column", gap: 14
        }}>
            <Loader2 size={42} style={{ animation: "spin 1s linear infinite", color: "#2563eb" }} />
            <h3>Analyzing Enrollment Data...</h3>
        </div>
    );

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="management-container prereg-container">

            {/* ── Header ── */}
            <div className="prereg-header">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                        <button onClick={() => navigate(-1)} className="back-btn-round">
                            <FaArrowLeft />
                        </button>
                        <h2>Live Enrollment</h2>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                            className="btn-2"
                            onClick={() => setShowCharts(v => !v)}
                            style={{ display: "flex", alignItems: "center", gap: 8, background: showCharts ? "#212a39" : "#64748b" }}
                        >
                            <BarChart2 size={17} />
                            {showCharts ? "Hide Charts" : "Show Charts"}
                        </button>
                        <ExportMenu onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} exporting={exporting} />
                    </div>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="insights-grid">
                <div className="insight-card university-stats clickable-card" onClick={() => setTypeFilter("All")}>
                    <div className="insight-header">
                        <span className="insight-icon icon-blue"><BookOpen size={18} /></span>
                        <span className="insight-label">Total Offerings</span>
                    </div>
                    <div className="insight-value-large">{stats.total}</div>
                    <div className="insight-footer">Active Semester Courses</div>
                </div>

                <div
                    className={`insight-card clickable-card ${typeFilter === "Empty" ? "active-card card-empty" : ""}`}
                    onClick={() => handleCardClick("Empty")}
                >
                    <div className="insight-header">
                        <span className="insight-icon icon-orange"><AlertCircle size={18} /></span>
                        <span className="insight-label">Empty Courses</span>
                    </div>
                    <div className="insight-value">{stats.empty}</div>
                    <div className="insight-footer">0 Students enrolled</div>
                </div>

                <div
                    className={`insight-card clickable-card ${typeFilter === "Graduates" ? "active-card card-grads" : ""}`}
                    onClick={() => handleCardClick("Graduates")}
                >
                    <div className="insight-header">
                        <span className="insight-icon icon-green"><GraduationCap size={18} /></span>
                        <span className="insight-label">Graduation Critical</span>
                    </div>
                    <div className="insight-value">{stats.withGrads}</div>
                    <div className="insight-footer">Contains seniors</div>
                </div>

                {/* Enrolled Students: informational only — not a filter trigger */}
                <div className="insight-card">
                    <div className="insight-header">
                        <span className="insight-icon icon-green">
                            <Users size={18} />
                        </span>
                        <span className="insight-label">Enrolled Students</span>
                    </div>
                    <div className="insight-value">
                        {enrolledCount}
                    </div>
                    <div className="insight-footer">enrolled in one or more courses</div>
                </div>
            </div>

            {/* ── Charts Section (compact grid, 4-up on wide screens) ── */}
            {showCharts && (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 16,
                    marginBottom: 24
                }}>

                    {/* Top courses by enrollment (wider card) */}
                    <ChartCard style={{ gridColumn: "span 2", minWidth: 0 }}>
                        <SectionTitle
                            icon={BarChart2}
                            title="Top Courses by Enrollment"
                            subtitle="Sorted by total students registered"
                        />
                        {chartData.topCourses.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={chartData.topCourses} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                                    <Tooltip content={<CustomBarTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="Students" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Graduating" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>No data available</div>
                        )}
                    </ChartCard>

                    {/* Enrollment health pie */}
                    <ChartCard>
                        <SectionTitle
                            icon={TrendingUp}
                            title="Enrollment Health"
                            subtitle="Category distribution"
                        />
                        <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                                <Pie
                                    data={chartData.categoryPie}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={42}
                                    outerRadius={65}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {chartData.categoryPie.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomPieTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                            {chartData.categoryPie.map((d, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                                    <div style={{ width: 9, height: 9, borderRadius: 3, background: d.fill, flexShrink: 0 }} />
                                    <span style={{ color: "#475569", flex: 1 }}>{d.name}</span>
                                    <strong style={{ color: d.fill }}>{d.value}</strong>
                                </div>
                            ))}
                        </div>
                    </ChartCard>

                    {/* Status breakdown pie (Open/Closed/Proposed) */}
                    <ChartCard>
                        <SectionTitle
                            icon={CheckCircle2}
                            title="Status Breakdown"
                            subtitle="Open vs Closed vs Proposed"
                        />
                        <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                                <Pie
                                    data={chartData.statusPie}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={42}
                                    outerRadius={65}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {chartData.statusPie.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomPieTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                            {chartData.statusPie.map((d, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                                    <div style={{ width: 9, height: 9, borderRadius: 3, background: d.fill, flexShrink: 0 }} />
                                    <span style={{ color: "#475569", flex: 1 }}>{d.name}</span>
                                    <strong style={{ color: d.fill }}>{d.value}</strong>
                                </div>
                            ))}
                        </div>
                    </ChartCard>

                    {/* Enrollment distribution */}
                    <ChartCard>
                        <SectionTitle
                            icon={Users}
                            title="Enrollment Distribution"
                            subtitle="Courses per student-count range"
                        />
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData.distributionBar} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#64748b" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                                <Tooltip content={<CustomBarTooltip />} />
                                <Bar dataKey="Courses" radius={[4, 4, 0, 0]}>
                                    {chartData.distributionBar.map((entry, i) => (
                                        <Cell
                                            key={i}
                                            fill={
                                                entry.range === "0" ? CHART_COLORS.danger :
                                                    entry.range === "1-5" ? CHART_COLORS.warning :
                                                        CHART_COLORS.primary
                                            }
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    {/* Staff load (wider card) */}
                    <ChartCard style={{ gridColumn: "span 2", minWidth: 0 }}>
                        <SectionTitle
                            icon={UserSquare2}
                            title="Instructor Load"
                            subtitle="Courses & students per instructor"
                        />
                        {chartData.staffLoad.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={chartData.staffLoad} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fontSize: 10, fill: "#64748b" }}
                                        width={90}
                                        tickFormatter={v => v.length > 12 ? v.slice(0, 12) + "…" : v}
                                    />
                                    <Tooltip content={<CustomBarTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="courses" name="Courses" fill={CHART_COLORS.purple} radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="students" name="Students" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>
                                No instructor data available
                            </div>
                        )}
                    </ChartCard>
                </div>
            )}

            {/* ── Controls ── */}
            <div className="table-controls">
                <div className="search-box">
                    <Search size={20} color="#9ca3af" />
                    <input
                        type="text"
                        placeholder="Search by name or code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="drop-filters-group">
                    <select
                        className="filter-dropdown"
                        style={{ padding: "8px", width: 150, marginTop: 0 }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="All">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="proposed">Proposed</option>
                    </select>
                    <select
                        className="filter-dropdown"
                        style={{ padding: "8px", width: 150, marginTop: 0 }}
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="All">All Types</option>
                        <option value="Graduates">With Graduates</option>
                        <option value="Empty">Zero Enrollment</option>
                        <option value="Suggestions">Low Demand</option>
                    </select>
                    <select
                        className="filter-dropdown"
                        style={{ padding: "8px", width: 150, marginTop: 0 }}
                        value={regulationFilter}
                        onChange={(e) => setRegulationFilter(e.target.value)}
                    >
                        <option value="All">All Regulations</option>
                        {regulationOptions.map(([key, displayLabel]) => (
                            <option key={key} value={key}>{displayLabel}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Main Table (first column sticky while scrolling horizontally) ── */}
            <div className="table-wrapper" style={{ overflowX: "auto" }}>
                <table>
                    <thead>
                        <tr>
                            <th style={{ position: "sticky", left: 0, zIndex: 3 }}>Course Details</th>
                            <th>Staff (Inst/TA)</th>
                            <th>Status</th>
                            <th>Students</th>
                            <th>Graduating</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTableData.map(off => (
                            <tr key={off._id}>
                                <td
                                    className="fetchCourse clickable-cell"
                                    style={{ position: "sticky", left: 0, zIndex: 1, boxShadow: "2px 0 4px -2px rgba(15,23,42,0.08)" }}
                                    onClick={() => handleViewStudents(
                                        off.courseId?._id, off._id,
                                        off.courseId?.courseName,
                                        off.instructorId?.staffName,
                                        off.taId?.staffName
                                    )}
                                >
                                    <div className="c-name">{off.courseId?.courseName || "Unknown Course"}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span className="c-id">{off.courseId?._id || off.courseId}</span>
                                        <span style={{ color: "#cbd5e1", fontSize: 11 }}>•</span>
                                        <span
                                            className="c-id"
                                            style={{
                                                color: (off.courseId?.courseRegulation || "").toLowerCase() === "new"
                                                    ? "#10b981"
                                                    : (off.courseId?.courseRegulation || "").toLowerCase() === "last"
                                                        ? "#8b5cf6"
                                                        : "#f59e0b"
                                            }}
                                        >
                                            {off.courseId?.courseRegulation || "Unknown"} reg.
                                        </span>
                                    </div>
                                </td>

                                <td style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>
                                    <div style={{ color: "#3b82f6", fontWeight: 500 }}>I: {off.instructorId?.staffName || "-"}</div>
                                    <div style={{ color: "#6b7280" }}>T: {off.taId?.staffName || "-"}</div>
                                </td>
                                <td>
                                    <StatusBadge status={off.status} />
                                </td>
                                <td>{off.enrolledCount || 0}</td>
                                <td className="text-center">
                                    <span className={(off.graduatingCount || 0) > 0 ? "g-critical" : "g-normal"}>
                                        {off.graduatingCount || 0}
                                    </span>
                                </td>
                                <td className="text-center">
                                    <StatusActions
                                        current={off.status}
                                        onChange={(newStatus) => handleStatusChange(off._id, newStatus)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredData.length === 0 && (
                    <div className="table-no-data">No courses found matching your criteria.</div>
                )}
            </div>

            {/* ── Students Modal (kept as-is) ── */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Students Enrolled in: {selectedCourse}</h3>
                            <button className="close-modal" onClick={() => setIsModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {loadingStudents ? (
                                <div className="loader">Loading students list...</div>
                            ) : students.length > 0 ? (
                                <div className="table-wrapper">
                                    <table className="students-list-table">
                                        <thead>
                                            <tr>
                                                <th>Student ID</th>
                                                <th>Student Name</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map(item => (
                                                <tr key={item.studentId?._id}>
                                                    <td>{item.studentId?._id}</td>
                                                    <td>{item.studentId?.studentName}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="no-data">No students enrolled in this course yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnrollmentStatsPage;