import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from './App';
import { idbPersister, queryClient } from './query';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
	throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
	<StrictMode>
		<PersistQueryClientProvider client={queryClient} persistOptions={{ persister: idbPersister }}>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</PersistQueryClientProvider>
	</StrictMode>,
);
