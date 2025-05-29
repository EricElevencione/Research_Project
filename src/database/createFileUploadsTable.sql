-- Create file_uploads table
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    processed_records INTEGER DEFAULT 0,
    error_message TEXT,
    uploaded_by VARCHAR(100),
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on upload_date for faster queries
CREATE INDEX idx_file_uploads_date ON file_uploads(upload_date);

-- Create index on status for filtering
CREATE INDEX idx_file_uploads_status ON file_uploads(status);

-- Add comment to table
COMMENT ON TABLE file_uploads IS 'Tracks uploaded Excel files and their processing status';

-- Add comments to columns
COMMENT ON COLUMN file_uploads.id IS 'Unique identifier for each upload';
COMMENT ON COLUMN file_uploads.filename IS 'System-generated filename';
COMMENT ON COLUMN file_uploads.original_filename IS 'Original name of the uploaded file';
COMMENT ON COLUMN file_uploads.file_size IS 'Size of the file in bytes';
COMMENT ON COLUMN file_uploads.file_type IS 'MIME type of the file';
COMMENT ON COLUMN file_uploads.upload_date IS 'When the file was uploaded';
COMMENT ON COLUMN file_uploads.status IS 'Current status: pending, processing, completed, failed';
COMMENT ON COLUMN file_uploads.processed_records IS 'Number of records processed from the file';
COMMENT ON COLUMN file_uploads.error_message IS 'Error message if processing failed';
COMMENT ON COLUMN file_uploads.uploaded_by IS 'Username or ID of the user who uploaded the file';
COMMENT ON COLUMN file_uploads.last_modified IS 'Last modification timestamp'; 