import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CalendarCheck, X } from 'lucide-react';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [requests, setRequests] = useState([]);
  const nextId = useRef(0);
  const showDialog = useCallback(options => new Promise(resolve => {
    const id = nextId.current++;
    setRequests(previous => [...previous, { ...options, id, resolve }]);
  }), []);
  const request = requests[0];

  return (
    <DialogContext.Provider value={showDialog}>
      {children}
      {request && <ActionDialog key={request.id} {...request} onFinish={value => {
        request.resolve(value);
        setRequests(previous => previous.slice(1));
      }} />}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}

function ActionDialog({ kind = 'alert', title, message, confirmText = 'Got it', cancelText = 'Keep unchanged', danger = false, required = false, defaultValue = '', onFinish }) {
  const dialog = useRef(null);
  const settled = useRef(false);
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const isPrompt = kind === 'prompt';
  const canCancel = kind !== 'alert';
  const Icon = danger ? AlertCircle : CalendarCheck;

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  const finish = result => {
    if (settled.current) return;
    settled.current = true;
    dialog.current.close();
    onFinish(result);
  };
  const dismiss = () => finish(isPrompt ? null : false);

  return (
    <dialog ref={dialog} className="modal-content care-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} onCancel={event => {
      event.preventDefault();
      dismiss();
    }}>
      <form onSubmit={event => {
        event.preventDefault();
        if (isPrompt && required && !value.trim()) return;
        finish(isPrompt ? value.trim() : true);
      }}>
        <div className="modal-header">
          <div className={`care-dialog-heading${danger ? ' is-danger' : ''}`}><Icon size={20} /><h3 id={`${id}-title`}>{title}</h3></div>
          <button type="button" className="btn-icon" aria-label="Close dialog" onClick={dismiss}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p id={`${id}-message`} className="care-dialog-message">{message}</p>
          {isPrompt && <div className="care-dialog-field">
            <label className="form-label" htmlFor={`${id}-reason`}>Reason {required ? '(required)' : '(optional)'}</label>
            <textarea id={`${id}-reason`} className="form-textarea" rows={3} value={value} onChange={event => setValue(event.target.value)} required={required} autoFocus />
          </div>}
        </div>
        <div className="modal-footer">
          {canCancel && <button type="button" className="btn btn-secondary" onClick={dismiss} autoFocus={!isPrompt}>{cancelText}</button>}
          <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={isPrompt && required && !value.trim()} autoFocus={!canCancel}>{confirmText}</button>
        </div>
      </form>
    </dialog>
  );
}
