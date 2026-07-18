import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from "../../services/api";
import swalService from "../../services/swal";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
    Settings, X, RefreshCw, Hash, Menu, Search, Save, CalendarDays, Sun, Moon, Loader2
} from 'lucide-react';
import './styles/ExamScheduleManager.css';


const EXAM_PERIODS = [
    { key: 'morning', label: 'First Period', startTime: '10:00 AM', icon: Sun },
    { key: 'evening', label: 'Second Period', startTime: '2:00 PM', icon: Moon },
];

const ExamScheduleManager = () => {
    const navigate = useNavigate();

    const [offerings, setOfferings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

    const [dayCount, setDayCount] = useState(5);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/final-exams/schedule');
            const list = res.data?.data || [];
            setOfferings(list);

            const maxDate = list.reduce((max, o) => {
                const d = Number(o.finalExamSchedule?.date);
                return !isNaN(d) && d > max ? d : max;
            }, 0);
            if (maxDate > 0) {
                setDayCount(prev => Math.max(prev, maxDate));
            }
        } catch (err) {
            console.error("❌ Exam schedule fetch error:", err);
            swalService.error("Fetch Error", "Could not load exam schedule data.");
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateSchedule = async () => {
        setGenerating(true);
        swalService.showLoading("Generating Exam Schedule...");
        try {
            const table = await api.post('/final-exams/generate-final-exam-schedule', { numberOfDays: dayCount });
            console.log(table)
            await fetchData();
            swalService.success("Success", "Exam schedule generated successfully");
            setIsGenerateModalOpen(false);
        } catch (err) {
            swalService.error("Generation Failed", err.response?.data?.message || "Failed to generate exam schedule");
        } finally {
            setGenerating(false);
        }
    };
    const handleAssignExam = async (offeringId, date, startTime) => {
        swalService.showLoading("Updating Exam Slot...");
        try {
            await api.post(`/final-exams/${offeringId}`, {
                date: String(date),
                startTime,
                place: "--",
            });
            await fetchData();
            swalService.close();
        } catch (err) {
            swalService.error("Update Failed", err.response?.data?.message || "Failed to update exam slot");
        }
    };

    const onDragEnd = (result) => {
        const { destination, draggableId } = result;
        if (!destination) return;

        // شكل الـ droppableId بتاع أي خانة في الجدول: "<date>__<periodKey>"
        if (destination.droppableId.includes('__')) {
            const [dateStr, periodKey] = destination.droppableId.split('__');
            const period = EXAM_PERIODS.find(p => p.key === periodKey);
            if (!period) return;
            handleAssignExam(draggableId, Number(dateStr), period.startTime);
        }
    };

    // مادة "مجدولة" = عندها date فعلي في finalExamSchedule
    const scheduledOfferings = offerings.filter(o => o.finalExamSchedule?.date);
    const unscheduledOfferings = offerings
        .filter(o => !o.finalExamSchedule?.date)
        .filter(o =>
            o.courseId?.courseName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.courseId?._id?.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const examDays = Array.from({ length: dayCount }, (_, i) => i + 1);

    const renderCourseCard = (offering) => (
        <div className="exam-uniform-card" title={offering.courseId?.courseName}>
            <p className="exam-course-name-text">
                {offering.courseId?.courseName || "Unknown"}
            </p>
            <div className="exam-course-details">
                <div className="exam-detail-item">
                    <Hash size={10} />
                    <span>{offering.courseId?._id || "N/A"}</span>
                </div>
                {offering.courseId?.courseRegulation && (
                    <div className="exam-detail-item">
                        <span className="exam-reg-badge">{offering.courseId.courseRegulation}</span>
                    </div>
                )}
            </div>
        </div>
    );

    if (loading) return (
        <div
            className="management-container"
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '80vh',
                flexDirection: 'column',
                gap: '14px'
            }}
        >
            <Loader2 size={42} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
            <h3>Initializing Exam Schedule...</h3>
        </div>
    );

    return (
        <div className="management-container exam-schedule-container">
            <div className="mobile-responsive-warning">
                <div className="warning-content">
                    <h2>Screen Too Small</h2>
                    <p>We apologize, managing the exam schedule requires a larger workspace.</p>
                    <p className="highlight">Please use a desktop or a tablet with a wider screen (minimum 1024px).</p>
                    <button className="btn-2" onClick={() => navigate(-1)}>Go Back</button>
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <main className="exam-schedule-main">
                    <header className="management-header">
                        <div className="prereg-header">
                            <h2>Final Exams Schedule</h2>
                        </div>
                        <div className="header-actions">
                            <button className="btn-1" onClick={() => setIsGenerateModalOpen(true)}>
                                <Settings size={18} /> Generate Schedule
                            </button>
                            {!isSidebarOpen && (
                                <button className="btn-1" onClick={() => setIsSidebarOpen(true)}>
                                    <Menu size={18} /> Show Catalog
                                </button>
                            )}
                        </div>
                    </header>

                    <div className="exam-table-wrapper">
                        <table className="exam-schedule-table">
                            <colgroup>
                                <col style={{ width: '110px' }} />
                                {EXAM_PERIODS.map((p) => (
                                    <col key={p.key} style={{ width: 'calc((100% - 110px) / 2)' }} />
                                ))}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th className="sticky-row sticky-col corner-header">Date</th>
                                    {EXAM_PERIODS.map((p) => (
                                        <th key={p.key} className="sticky-row period-header">
                                            <div className="period-label">
                                                <p.icon size={12} style={{ marginInlineEnd: 4 }} />
                                                {p.label}
                                            </div>
                                            <div className="time-range">{p.startTime}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {examDays.map((date) => (
                                    <tr key={date}>
                                        <td className="day-name sticky-col">
                                            <CalendarDays size={14} style={{ marginInlineEnd: 4 }} />
                                            Day {date}
                                        </td>
                                        {EXAM_PERIODS.map((period) => {
                                            const droppableId = `${date}__${period.key}`;
                                            const assignedCourses = scheduledOfferings.filter(o =>
                                                Number(o.finalExamSchedule?.date) === date &&
                                                o.finalExamSchedule?.startTime === period.startTime
                                            );

                                            return (
                                                <Droppable key={droppableId} droppableId={droppableId}>
                                                    {(provided, snapshot) => (
                                                        <td
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className={`slot ${snapshot.isDraggingOver ? 'drop-hover' : ''}`}
                                                        >
                                                            <div className="exam-courses-stack">
                                                                {assignedCourses.map((course, idx) => (
                                                                    <Draggable key={course._id} draggableId={course._id} index={idx}>
                                                                        {(provided) => (
                                                                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                                                {renderCourseCard(course)}
                                                                            </div>
                                                                        )}
                                                                    </Draggable>
                                                                ))}
                                                            </div>
                                                            {provided.placeholder}
                                                        </td>
                                                    )}
                                                </Droppable>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </main>

                <aside className={`schedule-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
                    <div className="s_sidebar-header">
                        <div className="head">
                            <div className="header-top">
                                <h3>Catalog</h3>
                                <button className="close-sidebar-btn" onClick={() => setIsSidebarOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="sidebar-search-wrapper">
                                <Search size={14} className="search-icon-inside" />
                                <input
                                    type="text"
                                    className="catalog-search-input"
                                    placeholder="Search by ID or Name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <p className='available-text'>{unscheduledOfferings.length} unscheduled courses</p>
                        </div>
                    </div>

                    <Droppable droppableId="sidebar" isDropDisabled>
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="course-list">
                                {unscheduledOfferings.map((offering, index) => (
                                    <Draggable key={offering._id} draggableId={offering._id} index={index}>
                                        {(provided) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                {renderCourseCard(offering)}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </aside>
            </DragDropContext>

            {/* Generate Schedule Modal */}
            {isGenerateModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content period-modal-wide">
                        <div className="modal-header">
                            <div className="title-with-icon">
                                <h2>Generate Exam Schedule</h2>
                            </div>
                            <button className="close-sidebar-btn" onClick={() => setIsGenerateModalOpen(false)}><X /></button>
                        </div>

                        <div className="modal-body">
                            <div className="config-top-bar">
                                <div className="input-group-row">
                                    <div className="input-field">
                                        <label>Number of Exam Days</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={dayCount}
                                            onChange={(e) => setDayCount(Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                    </div>
                                    <div className="input-field" style={{ flex: '2' }}>
                                        <label>Fixed Periods</label>
                                        <p style={{ margin: 0, color: '#555', fontSize: '0.85rem' }}>
                                            Morning 10:00 AM &nbsp;•&nbsp; Evening 2:00 PM
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setIsGenerateModalOpen(false)}>Cancel</button>
                            <button className="btn-1" disabled={generating} onClick={handleGenerateSchedule}>
                                <RefreshCw size={16} /> {generating ? "Generating..." : "Generate"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamScheduleManager;