/**
 * File Upload Middleware
 * ──────────────────────
 * Handles document uploads for patient appointments and consultations.
 * Automatically organizes files into a categorized directory structure:
 *
 * uploads/
 *   └── patient_<patientId>_<patientName>/
 *         ├── lab_results/
 *         ├── radiology/
 *         ├── prescriptions/
 *         ├── referral_letters/
 *         └── general/
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('node:crypto');
const Appointment = require('../models/Appointment');
const { pipeline } = require('node:stream');
const env = require('../config/env');
const { getBucket, discardUpload } = require('../services/fileStorage.service');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

// Map document type keys to human-friendly folder names
const TYPE_FOLDER_MAP = {
  lab_result: 'lab_results',
  'lab result': 'lab_results',
  lab_results: 'lab_results',
  radiology: 'radiology',
  'radiology / x-ray': 'radiology',
  xray: 'radiology',
  prescription: 'prescriptions',
  prescriptions: 'prescriptions',
  referral: 'referral_letters',
  referral_letter: 'referral_letters',
  'referral letter': 'referral_letters',
  general: 'general',
};

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      let patientFolder = 'general_patient';

      // 1. Resolve Patient or Walk-in folder
      const appointmentId = req.params.id || req.body.appointmentId;
      if (appointmentId) {
        const appointment = await Appointment.findById(appointmentId)
          .populate('patient', 'firstName lastName')
          .populate('walkIn', 'name');

        if (appointment) {
          if (appointment.patient) {
            const pId = appointment.patient._id.toString();
            const pName = `${appointment.patient.firstName || ''}_${appointment.patient.lastName || ''}`
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_');
            patientFolder = `patient_${pId}_${pName}`;
          } else if (appointment.walkIn) {
            const wId = appointment.walkIn._id.toString();
            const wName = (appointment.walkIn.name || 'walkin')
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_');
            patientFolder = `walkin_${wId}_${wName}`;
          }
        }
      } else if (req.body.patientId) {
        patientFolder = `patient_${req.body.patientId}_${(req.body.patientName || 'patient').toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      }

      // 2. Resolve Category Subfolder
      if (req.body.type !== undefined && typeof req.body.type !== 'string') {
        throw Object.assign(new Error('Document category must be text'), { statusCode: 400 });
      }
      const rawType = (req.body.type || 'general').toLowerCase().trim();
      const categoryFolder = TYPE_FOLDER_MAP[rawType] || 'general';

      // 3. Construct absolute path and ensure directory exists
      const targetDir = path.join(UPLOAD_ROOT, patientFolder, categoryFolder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Save relative path for easy URL construction
      req.uploadRelativePath = `/uploads/${patientFolder}/${categoryFolder}`;
      cb(null, targetDir);
    } catch (err) {
      cb(err);
    }
  },

  filename: (req, file, cb) => {
    // Sanitize original filename and prefix timestamp
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `${Date.now()}_${randomUUID()}_${basename}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(pdf|png|jpg|jpeg|gif|webp|doc|docx|txt|csv)$/i;
  if (!file.originalname.match(allowedExtensions)) {
    const error = new Error('Only medical documents, PDF, images, and text files are allowed.');
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const gridfsStorage = {
  _handleFile(req, file, callback) {
    let stream;
    try {
      stream = getBucket().openUploadStream(file.originalname, { metadata: { appointment: req.params.id } });
      pipeline(file.stream, stream, error => {
        if (error) {
          discardUpload({ storageId: stream.id }).catch(() => {}).finally(() => callback(error));
          return;
        }
        callback(null, { storageId: stream.id, storageUrl: `/uploads/gridfs/${stream.id}`,
          filename: file.originalname, size: stream.gridFSFile.length });
      });
    } catch (error) { callback(error); }
  },
  _removeFile(_req, file, callback) { discardUpload(file).then(() => callback(null), callback); },
};

const upload = multer({
  storage: env.UPLOAD_STORAGE === 'gridfs' ? gridfsStorage : storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
    files: 1,
    fields: 5,
    fieldSize: 4096,
  },
});

module.exports = {
  upload,
  UPLOAD_ROOT,
};
