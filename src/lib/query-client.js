import { QueryClient } from '@tanstack/react-query';
import { registerSessionCleanup } from '@/lib/sessionSecurity.mjs';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});
registerSessionCleanup(() => {
  void queryClientInstance.cancelQueries();
  queryClientInstance.clear();
});
