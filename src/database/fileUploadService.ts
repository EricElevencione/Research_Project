import { Pool } from 'pg';
import { FileUpload, FileUploadStatus } from '../types/FileUpload';

const pool = new Pool({
    // Your existing database configuration
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

export const fileUploadService = {
    // Create a new file upload record
    async createFileUpload(fileData: Omit<FileUpload, 'id' | 'upload_date' | 'last_modified'>): Promise<FileUpload> {
        const query = `
            INSERT INTO file_uploads 
            (filename, original_filename, file_size, file_type, status, processed_records, error_message, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const values = [
            fileData.filename,
            fileData.original_filename,
            fileData.file_size,
            fileData.file_type,
            fileData.status,
            fileData.processed_records,
            fileData.error_message,
            fileData.uploaded_by
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    },

    // Update file upload status
    async updateFileStatus(id: number, status: FileUploadStatus, processedRecords?: number, errorMessage?: string): Promise<FileUpload> {
        const query = `
            UPDATE file_uploads 
            SET status = $1, 
                processed_records = COALESCE($2, processed_records),
                error_message = COALESCE($3, error_message),
                last_modified = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `;

        const values = [status, processedRecords, errorMessage, id];
        const result = await pool.query(query, values);
        return result.rows[0];
    },

    // Get file upload by ID
    async getFileUpload(id: number): Promise<FileUpload | null> {
        const query = 'SELECT * FROM file_uploads WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    },

    // Get all file uploads with optional filtering
    async getFileUploads(status?: FileUploadStatus): Promise<FileUpload[]> {
        let query = 'SELECT * FROM file_uploads';
        const values: any[] = [];

        if (status) {
            query += ' WHERE status = $1';
            values.push(status);
        }

        query += ' ORDER BY upload_date DESC';
        const result = await pool.query(query, values);
        return result.rows;
    },

    // Delete file upload record
    async deleteFileUpload(id: number): Promise<void> {
        const query = 'DELETE FROM file_uploads WHERE id = $1';
        await pool.query(query, [id]);
    }
}; 