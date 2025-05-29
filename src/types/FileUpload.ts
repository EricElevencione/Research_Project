export interface FileUpload {
    id: number;
    filename: string;
    original_filename: string;
    file_size: number;
    file_type: string;
    upload_date: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    processed_records: number;
    error_message?: string;
    uploaded_by?: string;
    last_modified: Date;
}

export type FileUploadStatus = FileUpload['status']; 