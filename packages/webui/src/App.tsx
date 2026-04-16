import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Routes } from 'react-router';

import { queryClient } from './query';
import { createTrpcClient, trpc } from './trpc';

export function App() {
	const [trpcClient] = useState(createTrpcClient);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>
				<main>
					<Routes></Routes>
				</main>
			</QueryClientProvider>
		</trpc.Provider>
	);
}
