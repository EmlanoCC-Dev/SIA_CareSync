/**
 * Appointment Controller
 * ──────────────────────
 * Module 2: Appointment Module
 * Layer:    Presentation
 */

const appointmentService = require('../services/appointment.service');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const { UPLOAD_ROOT } = require('../middleware/upload');

async function requestCorrection(req, res, next) {
  try { res.json({ success: true, data: await appointmentService.requestCorrection(req.params.id, req.user, req.body) }); }
  catch (err) { next(err); }
}
async function resubmit(req, res, next) {
  try { res.json({ success: true, data: await appointmentService.resubmit(req.params.id, req.user, req.body) }); }
  catch (err) { next(err); }
}

/**
 * POST /api/appointments
 * Book a new appointment (patient).
 */
async function create(req, res, next) {
  try {
    const { doctorId, date, timeSlot, slotId, reason } = req.body;
    const appointment = await appointmentService.create({
      patientId: req.user.id,
      doctorId,
      date,
      timeSlot,
      slotId,
      reason,
    });
    res.status(201).json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id/approve
 * Approve a pending appointment (staff/admin).
 */
async function approve(req, res, next) {
  try {
    const appointment = await appointmentService.approve(req.params.id, req.user.id);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id/decline
 * Decline a pending appointment (staff, admin, or doctor).
 */
async function decline(req, res, next) {
  try {
    const { reason } = req.body;
    const appointment = await appointmentService.decline(req.params.id, req.user.id, reason);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id/cancel
 * Cancel an appointment (patient or doctor).
 */
async function cancel(req, res, next) {
  try {
    const { reason } = req.body;
    const appointment = await appointmentService.cancel(req.params.id, req.user.id, reason);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id/no-show
 * Mark patient as no-show (staff/admin).
 */
async function noShow(req, res, next) {
  try {
    const { reason } = req.body;
    const appointment = await appointmentService.noShow(req.params.id, req.user.id, reason);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id/check-in
 * Check in patient for consultation (staff/admin).
 */
async function checkIn(req, res, next) {
  try {
    const appointment = await appointmentService.checkIn(req.params.id, req.user);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id/documents
 * Upload consultation notes and lab/X-ray documents (doctor).
 */
async function uploadDocuments(req, res, next) {
  try {
    const { consultationNotes, documents, notesRevision } = req.body;
    const appointment = await appointmentService.uploadDocuments(req.params.id, req.user, {
      consultationNotes,
      documents,
      notesRevision,
    });
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/appointments/:id/files
 * Upload physical document file for patient appointment (Doctor/Staff).
 */
async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file was uploaded.',
      });
    }

    const { type, title } = req.body;
    if ((title !== undefined && typeof title !== 'string') || (type !== undefined && typeof type !== 'string')) {
      throw Object.assign(new Error('Document title and category must be text'), { statusCode: 400 });
    }
    const version = req.body.version === undefined ? undefined : (/^[1-9]\d*$/.test(req.body.version) ? Number(req.body.version) : NaN);
    const fileUrl = `${req.uploadRelativePath}/${req.file.filename}`;
    const filename = title && title.trim() ? title.trim() : req.file.originalname;

    const result = await appointmentService.attachFile(req.params.id, req.user, {
      filename,
      url: fileUrl,
      type,
    }, req.params.docId, version);

    res.status(201).json({
      success: true,
      data: result.document,
      appointment: result.appointment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/appointments/:id/documents/:docId
 * Remove an attached document.
 */
async function deleteDocument(req, res, next) {
  try {
    const appointment = await appointmentService.removeDocument(
      req.params.id,
      req.params.docId,
      req.user,
      req.body?.version
    );
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

async function downloadDocument(req, res, next) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.docId)) {
      throw Object.assign(new Error('Invalid document ID'), { statusCode: 400 });
    }
    const document = req.params.version
      ? await appointmentService.getDocumentVersion(req.params.id, req.params.docId, req.params.version, req.user)
      : req.appointment.documents.find(doc => String(doc._id) === req.params.docId);
    if (!document || typeof document.url !== 'string' || !document.url.startsWith('/uploads/')) {
      throw Object.assign(new Error('Uploaded document not found'), { statusCode: 404 });
    }
    const candidate = path.resolve(UPLOAD_ROOT, document.url.slice('/uploads/'.length));
    const inside = (root, file) => {
      const relative = path.relative(root, file);
      return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    };
    if (!inside(UPLOAD_ROOT, candidate)) throw Object.assign(new Error('Invalid document path'), { statusCode: 403 });
    const root = await fs.realpath(UPLOAD_ROOT);
    const file = await fs.realpath(candidate);
    if (!inside(root, file)) throw Object.assign(new Error('Invalid document path'), { statusCode: 403 });
    res.download(file, path.basename(document.filename), {
      headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    }, err => { if (err) next(err); });
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      err = Object.assign(new Error('Uploaded document not found'), { statusCode: 404 });
    }
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id/complete
 * Mark an appointment as completed (doctor/staff).
 */
async function complete(req, res, next) {
  try {
    const appointment = await appointmentService.complete(req.params.id, req.user);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appointments/:id
 * Get a single appointment by ID.
 */
async function getById(req, res, next) {
  try {
    const appointment = await appointmentService.getById(req.params.id);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appointments
 * List appointments — patients see their own; doctors see assigned; staff/admin see all.
 */
async function list(req, res, next) {
  try {
    let appointments;
    if (req.user.role === 'Patient') {
      appointments = await appointmentService.listByPatient(req.user.id);
    } else if (req.user.role === 'Doctor') {
      appointments = await appointmentService.listByDoctor(req.user.id);
    } else {
      appointments = await appointmentService.listAll({
        status: req.query.status,
        date: req.query.date,
      });
    }
    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
}

async function assignSlot(req, res, next) {
  try {
    const appointment = await appointmentService.assignSlot(req.params.id, req.body.slotId, req.user.id);
    res.json({ success: true, data: appointment });
  } catch (err) { next(err); }
}

async function startConsultation(req, res, next) {
  try { res.json({ success: true, data: await appointmentService.startConsultation(req.params.id, req.user) }); }
  catch (err) { next(err); }
}

async function listComments(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await appointmentService.listComments(req.params.id, req.user) });
  } catch (err) { next(err); }
}

async function getVersions(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await appointmentService.getVersions(req.params.id, req.user) });
  } catch (err) { next(err); }
}

async function addComment(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ success: true, data: await appointmentService.addComment(req.params.id, req.user, req.body?.message) });
  } catch (err) { next(err); }
}

module.exports = {
  requestCorrection,
  resubmit,
  getVersions,
  listComments,
  addComment,
  startConsultation,
  downloadDocument,
  assignSlot,
  create,
  approve,
  decline,
  cancel,
  noShow,
  checkIn,
  uploadDocuments,
  uploadFile,
  deleteDocument,
  complete,
  getById,
  list,
};
