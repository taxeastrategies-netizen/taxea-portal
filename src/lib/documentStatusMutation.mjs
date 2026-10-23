// Document-review metadata only. This never updates an invoice, payment, OCR
// approval, journal, tax model, file URL, ownership or access permissions.
export const DOCUMENT_REVIEW_STATUSES = new Set(['revisado', 'aprobado', 'rechazado']);
export const documentStatusKey = variables => ['document-review-status', variables.userId, variables.companyId, variables.documentId];

export function documentStatusOptions({queryClient, persist, isCurrent, onVisible}) {
  const valid = variables => variables.userId && variables.companyId && variables.documentId &&
    variables.previous?.id === variables.documentId && variables.previous?.company_id === variables.companyId &&
    DOCUMENT_REVIEW_STATUSES.has(variables.nextStatus);
  return {
    mutationKey: ['change-document-review-status'],
    retry: false,
    onMutate: async variables => {
      if (!valid(variables) || !isCurrent(variables)) return null;
      const queryKey = documentStatusKey(variables);
      await queryClient.cancelQueries({queryKey, exact: true});
      if (!isCurrent(variables)) return null;
      const previous = variables.previous;
      queryClient.setQueryData(queryKey, {...previous, estado: variables.nextStatus, _taxeaStatusPending: true});
      onVisible(variables, {estado: variables.nextStatus, _taxeaStatusPending: true});
      return {queryKey, previous};
    },
    mutationFn: async variables => {
      if (!valid(variables) || !isCurrent(variables)) throw Error('La sesión o el documento han cambiado.');
      // Explicit allowlist, not a spread of the document or caller-supplied patch.
      const response = await persist(variables.documentId, {estado: variables.nextStatus});
      const confirmed = response?.data ?? response;
      if (confirmed?.id !== variables.documentId || confirmed?.estado !== variables.nextStatus ||
          (confirmed.company_id && confirmed.company_id !== variables.companyId)) {
        throw Error('El servidor no ha confirmado el estado solicitado.');
      }
      return confirmed;
    },
    onError: (_error, variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.queryKey, context.previous);
      if (isCurrent(variables)) onVisible(variables, {estado: context.previous.estado, _taxeaStatusPending: false});
    },
    onSuccess: (confirmed, variables, context) => {
      if (context) queryClient.setQueryData(context.queryKey, confirmed);
      if (isCurrent(variables)) onVisible(variables, {estado: confirmed.estado, _taxeaStatusPending: false});
    },
  };
}
