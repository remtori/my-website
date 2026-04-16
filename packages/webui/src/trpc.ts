import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@website/server/src/router';

export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient() {
	return trpc.createClient({
		links: [
			httpBatchLink({
				url: import.meta.env.VITE_TRPC_URL ?? '/trpc',
				headers() {
					const token = localStorage.getItem('auth_token');
					return token ? { Authorization: `Bearer ${token}` } : {};
				},
			}),
		],
	});
}
