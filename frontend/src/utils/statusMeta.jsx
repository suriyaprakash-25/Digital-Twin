import React from 'react';
import { Clock, AlertTriangle, CheckCircle, Loader2, XCircle } from 'lucide-react';

export const statusMeta = {
  REQUESTED:   { label: 'Pending',     color: 'bg-amber-100 text-amber-700',    icon: <Clock className="h-3.5 w-3.5" /> },
  PENDING:     { label: 'Pending',     color: 'bg-amber-100 text-amber-700',    icon: <Clock className="h-3.5 w-3.5" /> },
  MORE_INFO_REQUIRED: { label: 'Need Info', color: 'bg-orange-100 text-orange-700', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ACCEPTED:    { label: 'Accepted',    color: 'bg-teal-100 text-teal-700',      icon: <CheckCircle className="h-3.5 w-3.5" /> },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-violet-100 text-violet-700',  icon: <Loader2 className="h-3.5 w-3.5" /> },
  COMPLETED:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700',icon: <CheckCircle className="h-3.5 w-3.5" /> },
  REJECTED:    { label: 'Rejected',    color: 'bg-red-100 text-red-700',        icon: <XCircle className="h-3.5 w-3.5" /> },
};
