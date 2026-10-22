// Only a personal notification is hidden optimistically, never a source document.
export function notificationDeleteOptions({ queryClient, queryKey, persist, isCurrent }) {
  return {
    retry: false,
    mutationFn: async variables => {
      if (!isCurrent() || !variables.rows.some(row => row.id === variables.id)) throw Error('Aviso no disponible en esta sesión.');
      await persist(variables.id);
    },
    onMutate: async variables => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      const rows = queryClient.getQueryData(queryKey) ?? variables.rows;
      const index = rows.findIndex(row => row.id === variables.id);
      if (!isCurrent() || index < 0) return null;
      const row = rows[index];
      queryClient.setQueryData(queryKey, rows.filter(item => item.id !== variables.id));
      return { row, index };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(queryKey, (rows = []) => {
        if (rows.some(row => row.id === context.row.id)) return rows;
        const restored = [...rows];
        restored.splice(Math.min(context.index, rows.length), 0, context.row);
        return restored;
      });
    },
    onSettled: () => {
      if (isCurrent()) return queryClient.invalidateQueries({ queryKey, exact: true });
    },
  };
}
