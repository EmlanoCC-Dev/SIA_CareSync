import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({ id, className = 'form-input', visibilityLabel = 'password', ...props }) {
  const [visible, setVisible] = useState(false);
  const action = `${visible ? 'Hide' : 'Show'} ${visibilityLabel}`;

  return <div className="password-field">
    <input {...props} id={id} className={className} type={visible ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} />
    <button type="button" className="password-visibility" disabled={props.disabled}
      aria-label={action} title={action} aria-controls={id} aria-pressed={visible}
      onClick={() => setVisible(previous => !previous)}>
      {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      <span>{visible ? 'Hide' : 'Show'}</span>
    </button>
  </div>;
}
