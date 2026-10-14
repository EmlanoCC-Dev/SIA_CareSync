import React from 'react';

export default function AppointmentPatientDetails({ appointment }) {
  const { patient, walkIn } = appointment;
  const name = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ').trim()
    || walkIn?.name?.trim() || appointment.followUpContact?.name || 'Patient details unavailable';
  const contact = patient?.email || walkIn?.email || appointment.followUpContact?.email;
  const phone = patient?.contactNumber || walkIn?.contactNumber || appointment.followUpContact?.contactNumber;

  return <div className="appointment-patient-details">
    <strong>{name}</strong>
    {contact && <div className="appointment-patient-contact">{contact}</div>}
    {phone && <div className="appointment-patient-contact">{phone}</div>}
    {appointment.followUpOf && <div className="appointment-visit-source">Follow-up visit</div>}
    {walkIn && <div className="appointment-visit-source">Walk-in{walkIn.queueNumber != null ? ` · Queue #${walkIn.queueNumber}` : ''}</div>}
    {!walkIn && appointment.queueNumber != null && <div className="appointment-visit-source">Scheduled · Queue #A-{appointment.queueNumber}</div>}
  </div>;
}
