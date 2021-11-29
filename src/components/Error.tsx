import type { NextPage } from 'next';

export const Error: NextPage<{ statusCode: number }> = ({ statusCode }) => {
	return <div style={{ textAlign: 'center' }}>Error {statusCode}</div>;
};

Error.getInitialProps = async ({ res, err }) => {
	const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
	return { statusCode };
};
