import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function WorkspaceNavigation({ children, label = 'Workspace' }) {
  const [container, setContainer] = useState(null);

  useEffect(() => {
    setContainer(document.getElementById('workspace-navigation'));
  }, []);

  return container ? createPortal(
    <nav className="dashboard-tabs" aria-label={label}>{children}</nav>,
    container,
  ) : null;
}
