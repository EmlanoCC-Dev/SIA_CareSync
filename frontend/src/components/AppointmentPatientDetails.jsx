import React from 'react';

export default function AppointmentPatientDetails({ appointment }) {
  const { patient, walkIn } = appointment;
  const name = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ').trim()
    || walkIn?.name?.trim() || 'Patient details unavailable';
  const contact = patient?.email || walkIn?.email || patient?.contactNumber || walkIn?.contactNumber;

  return <div className="appointment-patient-details">
    <strong>{name}</strong>
    {contact && <div className="appointment-patient-contact">{contact}</div>}
    {walkIn && <div className="appointment-visit-source">Walk-in{walkIn.queueNumber != null ? ` · Queue #${walkIn.queueNumber}` : ''}</div>}
    {!walkIn && appointment.queueNumber != null && <div className="appointment-visit-source">Scheduled · Queue #A-{appointment.queueNumber}</div>}
  </div>;
}
