// Reversible UI preferences only; never a journal, invoice, payment or tax filing.
export const notificationPreferenceKey = userId => ['notification-preferences', userId];

export function notificationPreferenceOptions({ queryClient, persist, isCurrent, onVisible }) {
  return {
    mutationKey: ['save-notification-preferences'],
    retry: false,
    mutationFn: async variables => {
      if (!isCurrent(variables)) throw new Error('La sesión ha cambiado. No se guardaron preferencias.');
      await persist(variables.next);
      return variables.next;
    },
    onMutate: async variables => {
      const queryKey = notificationPreferenceKey(variables.userId);
      await queryClient.cancelQueries({ queryKey, exact: true });
      const previous = variables.previous;
      queryClient.setQueryData(queryKey, variables.next);
      if (isCurrent(variables)) onVisible(variables.next);
      return { queryKey, previous };
    },
    onError: (_error, variables, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previous);
      if (isCurrent(variables)) onVisible(context?.previous ?? variables.previous);
    },
    onSuccess: (value, variables, context) => {
      queryClient.setQueryData(context.queryKey, value);
      if (isCurrent(variables)) onVisible(value);
    },
  };
}
