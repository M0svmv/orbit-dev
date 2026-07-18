import React, { useState, useEffect } from 'react';
import { X, Upload, Download, Loader2, Trash2 } from 'lucide-react';
import api from '../services/api';

const REQUIRED_FIELDS = ['academicId', 'studentName', 'username', 'studentPhone', 'studentEmail', 'password', 'regulation'];

const StudentCSVModal = ({ isOpen, onClose, onUploadSuccess }) => {
    const [data, setData] = useState([]);
    const [errors, setErrors] = useState([]);
    const [existingStudents, setExistingStudents] = useState([]);

    useEffect(() => {
        if (!isOpen) {
            setData([]);
            setErrors([]);
        } else {
            fetchExistingStudents();
        }
    }, [isOpen]);

    const fetchExistingStudents = async () => {
        try {
            const res = await api.get('/students');
            setExistingStudents(res.data);
        } catch (err) { console.error('Failed to fetch students:', err); }
    };

    const downloadTemplate = () => {
        const csv = `"academicId","studentName","username","studentPhone","studentEmail","password","regulation"
"224001","Youssef Ahmed","youssef.22","01123456789","youssef@edu.com","pass123","last"`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'students_template.csv';
        a.click();
    };

    // validateData now takes the rows to validate and returns the computed errors,
    // instead of also setting state directly - this lets us reuse it after edits/deletes.
    const computeErrors = (rows) => {
        const foundErrors = [];
        const fileIds = rows.map(r => r.academicId);
        const duplicatesInFile = fileIds.filter((id, i) => fileIds.indexOf(id) !== i);

        rows.forEach((row, idx) => {
            const rowErrors = {};

            if (!row.academicId) rowErrors.academicId = "Missing ID";
            if (!row.studentName) rowErrors.studentName = "Missing Name";
            if (!row.username) rowErrors.username = "Missing Username";
            if (!row.studentPhone) rowErrors.studentPhone = "Missing Phone";
            if (!row.studentEmail) rowErrors.studentEmail = "Missing Email";
            if (!row.password) rowErrors.password = "Missing Password";
            if (!row.regulation) rowErrors.regulation = "Missing Regulation";

            // Uniqueness checks
            if (row.academicId && duplicatesInFile.includes(row.academicId)) rowErrors.academicId = "Duplicate in file";
            if (row.academicId && existingStudents.some(s => s._id === row.academicId)) rowErrors.academicId = "Already exists";

            if (Object.keys(rowErrors).length) foundErrors.push({ line: idx + 2, fields: rowErrors });
        });

        return foundErrors;
    };

    const validateData = (rows) => {
        setData(rows);
        setErrors(computeErrors(rows));
    };

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim() !== "");
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const parsed = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.replace(/"/g, '').trim());
                const obj = {};
                headers.forEach((h, i) => obj[h] = values[i] || "");
                return obj;
            });
            validateData(parsed);
        };
        reader.readAsText(file);
        // allow re-selecting the same file again later
        e.target.value = '';
    };

    // Called when a cell is edited inline. Re-runs validation on the updated rows
    // so error highlighting and the error count stay in sync immediately.
    const handleCellEdit = (rowIndex, field, value) => {
        const updated = data.map((row, i) => i === rowIndex ? { ...row, [field]: value } : row);
        setData(updated);
        setErrors(computeErrors(updated));
    };

    // Removes a single row (e.g. via a per-row delete button)
    const handleDeleteRow = (rowIndex) => {
        const updated = data.filter((_, i) => i !== rowIndex);
        setData(updated);
        setErrors(computeErrors(updated));
    };

    // Keeps only the rows that currently have no validation errors.
    const handleRemoveInvalidRows = () => {
        const invalidLines = new Set(errors.map(e => e.line));
        const cleaned = data.filter((_, i) => !invalidLines.has(i + 2));
        setData(cleaned);
        setErrors(computeErrors(cleaned));
    };

    if (!isOpen) return null;

    const hasError = (rowIndex, field) => {
        const errorObj = errors.find(e => e.line === rowIndex + 2);
        return errorObj && errorObj.fields[field];
    };

    const getError = (rowIndex, field) => {
        const errorObj = errors.find(e => e.line === rowIndex + 2);
        return errorObj ? errorObj.fields[field] : null;
    };

    const rowHasAnyError = (rowIndex) => errors.some(e => e.line === rowIndex + 2);
    const invalidRowCount = errors.length;
    const validRowCount = data.length - invalidRowCount;

    return (
        <div className="modal-overlay">
            <div className="modal-card wide">
                <div className="modal-head">
                    <h3>Import Students via CSV</h3>
                    <X onClick={onClose} style={{ cursor: 'pointer' }} />
                </div>
                <div className="modal-body">
                    <div className="template-alert">
                        <span>Use correct format</span>
                        <button className="btn-main" onClick={downloadTemplate}><Download size={14} /> Template</button>
                    </div>

                    <div className="drop-zone">
                        <input type="file" accept=".csv" onChange={handleFile} />
                        <Upload size={20} />
                        <p>Click or drag student CSV file here</p>
                    </div>

                    {data.length > 0 && (
                        <>
                            <div className="preview-toolbar">
                                <span className="preview-summary">
                                    {validRowCount} valid · {invalidRowCount} with issues
                                </span>
                                <button
                                    className="btn-secondary"
                                    onClick={handleRemoveInvalidRows}
                                    disabled={invalidRowCount === 0}
                                >
                                    <Trash2 size={14} /> Remove all rows with issues
                                </button>
                            </div>

                            <div className="preview-table-wrapper">
                                <table className="preview-table">
                                    <thead>
                                        <tr>
                                            <th>Academic ID</th>
                                            <th>Name</th>
                                            <th>Username</th>
                                            <th>Phone</th>
                                            <th>Email</th>
                                            <th>Regulation</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map((row, i) => (
                                            <tr key={i} className={rowHasAnyError(i) ? "row-error" : ""}>
                                                {REQUIRED_FIELDS.filter(f => f !== 'password').map(field => (
                                                    <td key={field} className={hasError(i, field) ? "cell-error" : ""}>
                                                        <input
                                                            className="cell-input"
                                                            value={row[field] || ""}
                                                            onChange={(e) => handleCellEdit(i, field, e.target.value)}
                                                            title={getError(i, field) || ""}
                                                        />
                                                        {hasError(i, field) && (
                                                            <span className="cell-error-msg">{getError(i, field)}</span>
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="cell-actions">
                                                    <Trash2
                                                        size={16}
                                                        className="row-delete-icon"
                                                        onClick={() => handleDeleteRow(i)}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    <button disabled={errors.length > 0 || data.length === 0}
                        className="btn-submit"
                        onClick={() => onUploadSuccess(data)}>
                        Import {data.length} Students
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentCSVModal;