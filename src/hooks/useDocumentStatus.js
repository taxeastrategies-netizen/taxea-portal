import {useEffect, useRef, useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {base44} from '@/api/base44Client';
import {DOCUMENT_REVIEW_STATUSES, documentStatusOptions} from '@/lib/documentStatusMutation.mjs';

export default function useDocumentStatus({docs, setDocs, companyId, userId, isAdmin}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const scope = useRef(null), mounted = useRef(true), flight = useRef(null), latest = useRef(docs);
  scope.current = {companyId, userId, isAdmin}; latest.current = docs;
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {setError(''); setMessage('');}, [companyId, userId, isAdmin]);
  const isCurrent = variables => mounted.current && scope.current.isAdmin &&
    scope.current.companyId === variables.companyId && scope.current.userId === variables.userId;
  const mutation = useMutation(documentStatusOptions({queryClient,
    persist: (id, patch) => base44.entities.Document.update(id, patch),
    isCurrent,
    onVisible: (variables, patch) => setDocs(current => current.map(doc =>
      doc.id === variables.documentId && doc.company_id === variables.companyId ? {...doc, ...patch} : doc)),
  }));
  const changeStatus = (id, updates) => {
    if (flight.current) return;
    const previous = latest.current.find(doc => doc.id === id && doc.company_id === companyId);
    if (!isAdmin || !userId || !companyId || !previous || !updates ||
        Object.keys(updates).some(key => key !== 'estado') || !DOCUMENT_REVIEW_STATUSES.has(updates.estado)) {
      setError('No se puede cambiar el estado de este documento desde esta sesión.'); return;
    }
    if (previous.estado === updates.estado) {
      setError(''); setMessage('El documento ya tiene ese estado.'); return;
    }
    const variables = {documentId: id, companyId, userId, previous, nextStatus: updates.estado};
    const token = {}; flight.current = token;
    setError(''); setMessage('Guardando cambio documental…');
    void mutation.mutateAsync(variables).then(() => {
      if (isCurrent(variables)) setMessage('Estado del documento actualizado.');
    }).catch(() => {
      if (isCurrent(variables)) {
        setMessage('');
        setError('No se ha podido confirmar el cambio. Se muestra el estado anterior; actualiza para comprobarlo o vuelve a intentarlo.');
      }
    }).finally(() => {
      if (flight.current === token) flight.current = null;
      // A role may be revoked while the request is running. Never leave a
      // provisional approval visible, or carry it into another identity.
      if (mounted.current && scope.current.companyId === variables.companyId &&
          scope.current.userId === variables.userId && !scope.current.isAdmin) {
        setDocs(current => current.map(doc => doc.id === id && doc.company_id === variables.companyId ?
          {...doc, estado: previous.estado, _taxeaStatusPending: false} : doc));
      }
    });
  };
  return {changeStatus, pending: mutation.isPending, error, message};
}

