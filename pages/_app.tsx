import type { AppProps } from 'next/app';
import { Layout } from '~/components/Layout';

import 'normalize.css/normalize.css';
import 'highlight.js/styles/stackoverflow-dark.css';
import '~/styles/globals.scss';

function MyApp({ Component, pageProps }: AppProps) {
	return (
		<Layout>
			<Component {...pageProps} />
		</Layout>
	);
}

export default MyApp;
