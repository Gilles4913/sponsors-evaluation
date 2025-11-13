import { createContext, useContext, ReactNode } from 'react';

interface RouteParams {
  token?: string;
  slug?: string;
  idOrKey?: string;
  id?: string;
  tenantId?: string;
}

const ParamsContext = createContext<RouteParams>({});

export function useParams() {
  return useContext(ParamsContext);
}

interface RouterProps {
  children: ReactNode;
}

export function Router({ children }: RouterProps) {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);

  const params: RouteParams = {};

  if ((parts[0] === 'sponsor' || parts[0] === 'respond') && parts[1]) {
    params.token = parts[1];
  } else if (parts[0] === 'p' && parts[1]) {
    params.slug = parts[1];
  } else if (parts[0] === 'template' && parts[1]) {
    params.idOrKey = parts[1];
  } else if (parts[0] === 'templates' && parts[1]) {
    params.id = parts[1];
  } else if (parts[0] === 'admin' && parts[1] === 'clubs' && parts[2] && parts[3] === 'edit') {
    params.tenantId = parts[2];
  }

  return <ParamsContext.Provider value={params}>{children}</ParamsContext.Provider>;
}
