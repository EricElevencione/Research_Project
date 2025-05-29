import React, { useState } from 'react';
import '../assets/css/UploadPage.css';
import { FaCloudUploadAlt } from 'react-icons/fa';

const UploadPage: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.type === 'application/vnd.ms-excel') {
                setSelectedFile(file);
                setMessage(null);
            } else {
                setMessage({ type: 'error', text: 'Please select a valid Excel file (.xlsx or .xls)' });
                setSelectedFile(null);
            }
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setMessage({ type: 'error', text: 'Please select a file first' });
            return;
        }

        setIsUploading(true);
        setMessage(null);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch('http://localhost:5000/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'File uploaded successfully!' });
                setSelectedFile(null);
            } else {
                const error = await response.json();
                setMessage({ type: 'error', text: error.message || 'Upload failed' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'An error occurred while uploading the file' });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="upload-container">
            <h2>Upload Excel File</h2>

            <div className="upload-box">
                <div className="upload-area">
                    <input
                        type="file"
                        id="file-input"
                        className="file-input"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                    />
                    <label htmlFor="file-input" className="file-label">
                        <FaCloudUploadAlt className="upload-icon" />
                        <span>{selectedFile ? selectedFile.name : 'Click to select an Excel file'}</span>
                    </label>
                </div>

                {message && (
                    <div className={`message ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <button
                    className="upload-button"
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                >
                    {isUploading ? 'Uploading...' : 'Upload File'}
                </button>
            </div>

            <div className="upload-instructions">
                <h3>Instructions</h3>
                <ul>
                    <li>Only Excel files (.xlsx or .xls) are accepted</li>
                    <li>Maximum file size: 10MB</li>
                    <li>Make sure your file contains the required columns</li>
                    <li>Data will be validated before being stored in the database</li>
                </ul>
            </div>
        </div>
    );
};

export default UploadPage;
