import { Content } from '~/components/Content';
import content from '@content/home.md';
import Script from 'next/script';

export default function Home() {
	return (
		<>
			{/* NetlifyIdentity will redirect to homepage when login */}
			<Script
				id="netlifyIdentity"
				strategy='afterInteractive'
				dangerouslySetInnerHTML={{
					__html: `
						if (window.netlifyIdentity) {
							window.netlifyIdentity.on("init", function(user) {
								if (!user) {
									window.netlifyIdentity.on("login", function() {
										document.location.href = "/admin/";
									});
								}
							});
						}
					`
				}}
			/>
			<Content meta={content.attributes} html={content.html} path={`home.md`} />
		</>
	)
};
