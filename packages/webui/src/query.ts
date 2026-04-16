import { QueryClient } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			gcTime: 1000 * 60 * 60,
			staleTime: 1000 * 60 * 5,
			retry: 1,
		},
	},
});

const QUERY_CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

export const idbPersister: Persister = {
	persistClient: async (client: PersistedClient) => {
		await set(QUERY_CACHE_KEY, client);
	},
	restoreClient: async () => {
		const client = await get<PersistedClient>(QUERY_CACHE_KEY);
		return client ?? undefined;
	},
	removeClient: async () => {
		await del(QUERY_CACHE_KEY);
	},
};
