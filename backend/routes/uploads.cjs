const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

const proofsFolderName = 'ownership-transfer-proofs';
const uploadsRoot = path.join(__dirname, '..', 'uploads');
const proofsDir = path.join(uploadsRoot, proofsFolderName);

if (!fs.existsSync(proofsDir)) {
    fs.mkdirSync(proofsDir, { recursive: true });
}

const sanitizeFileName = (value = '') =>
    String(value).replace(/[^a-zA-Z0-9._-]/g, '_');

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, proofsDir);
    },
    filename: (_req, file, cb) => {
        const now = Date.now();
        const token = Math.random().toString(36).slice(2, 10);
        const safe = sanitizeFileName(file.originalname || 'proof.jpg');
        cb(null, `${now}-${token}-${safe}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 12
    },
    fileFilter: (_req, file, cb) => {
        const allowed = file.mimetype === 'image/png' || file.mimetype === 'image/jpeg';
        if (!allowed) {
            return cb(new Error('Only PNG and JPG files are allowed.'));
        }
        cb(null, true);
    }
});

router.post('/ownership-proofs', upload.array('files', 12), (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
        return res.status(400).json({
            message: 'No proof files uploaded.'
        });
    }

    const uploaded = files.map((file) => ({
        storage_bucket: 'local-uploads',
        storage_path: `${proofsFolderName}/${file.filename}`,
        file_name: file.originalname || file.filename,
        mime_type: file.mimetype || '',
        file_size_bytes: Number(file.size) || 0,
        public_url: `/uploads/${proofsFolderName}/${file.filename}`
    }));

    return res.json({ files: uploaded });
});

router.post('/ownership-proofs/delete', (req, res) => {
    const paths = Array.isArray(req.body?.paths) ? req.body.paths : [];
    if (paths.length === 0) {
        return res.json({ removed: 0 });
    }

    let removed = 0;
    paths.forEach((relativePath) => {
        const normalized = String(relativePath || '').replace(/\\/g, '/');
        if (!normalized.startsWith(`${proofsFolderName}/`)) {
            return;
        }

        const fileName = normalized.slice(`${proofsFolderName}/`.length);
        if (!fileName || fileName.includes('..') || fileName.includes('/')) {
            return;
        }

        const absolutePath = path.join(proofsDir, fileName);
        if (fs.existsSync(absolutePath)) {
            try {
                fs.unlinkSync(absolutePath);
                removed += 1;
            } catch (error) {
                // Keep best-effort cleanup behavior.
            }
        }
    });

    return res.json({ removed });
});

router.use((error, _req, res, _next) => {
    if (error && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            message: 'One or more files are too large (max 10MB each).'
        });
    }

    return res.status(400).json({
        message: error?.message || 'Failed to upload proof files.'
    });
});

module.exports = router;
