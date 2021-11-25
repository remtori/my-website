import type { AppProps } from 'next/app';
import { Layout } from '~/components/Layout';

import 'normalize.css/normalize.css';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';
import 'prismjs/plugins/diff-highlight/prism-diff-highlight.css';
import '~/styles/globals.scss';

function MyApp({ Component, pageProps }: AppProps) {
	return (
		<Layout>
			<Component {...pageProps} />
		</Layout>
	);
}

export default MyApp;
