import React, { useEffect, useState } from 'react';

export default function EmailVerificationCode({ id, value, onChange, resendAt, onResend, disabled }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  const seconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return <>
    <label className="form-label" htmlFor={id}>Email verification code</label>
    <input id={id} className="form-input otp-code" type="text" inputMode="numeric" autoComplete="one-time-code"
      pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={value} autoFocus required disabled={disabled}
      aria-describedby={`${id}-help`} onChange={event => onChange(event.target.value.replace(/\D/g, ''))} />
    <div className="otp-actions">
      <small id={`${id}-help`}>Use the latest code. It expires in 10 minutes.</small>
      <button className="btn btn-secondary btn-sm" type="button" disabled={disabled || seconds > 0} onClick={onResend}>
        {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
      </button>
    </div>
  </>;
}
