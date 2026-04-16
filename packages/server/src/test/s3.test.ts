import './env-setup';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { reloadEnv } from '@/env';

type AwsCommandInput = Record<string, unknown>;

type AwsMockState = {
	send: (command: { input: AwsCommandInput }) => Promise<unknown>;
};

const { awsMockState } = vi.hoisted(() => {
	const state: AwsMockState = {
		send: async () => {
			throw new Error('awsMockState.send not configured for this test');
		},
	};
	return { awsMockState: state };
});

vi.mock('@aws-sdk/client-s3', () => {
	class S3Client {
		send(command: { input: AwsCommandInput }) {
			return awsMockState.send(command);
		}
	}

	class ListObjectsV2Command {
		input: AwsCommandInput;
		constructor(input: AwsCommandInput) {
			this.input = input;
		}
	}

	class GetObjectCommand {
		input: AwsCommandInput;
		constructor(input: AwsCommandInput) {
			this.input = input;
		}
	}

	class PutObjectCommand {
		input: AwsCommandInput;
		constructor(input: AwsCommandInput) {
			this.input = input;
		}
	}

	return {
		S3Client,
		ListObjectsV2Command,
		GetObjectCommand,
		PutObjectCommand,
	};
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('MDX cache', () => {
	it('loads all MDX keys across ListObjectsV2 pagination', async () => {
		process.env.S3_BUCKET = 'bucket';
		reloadEnv();

		const listedTokens: Array<string | undefined> = [];
		const fetchedKeys: string[] = [];
		awsMockState.send = async (command) => {
			const input = command.input;
			if (typeof input.Prefix === 'string') {
				listedTokens.push(input.ContinuationToken as string | undefined);
				const token = input.ContinuationToken as string | undefined;
				if (token === undefined) {
					return {
						Contents: [{ Key: 'mdx/one.mdx' }, { Key: 'mdx/skip.txt' }, { Key: 'mdx/two.mdx' }],
						IsTruncated: true,
						NextContinuationToken: 'page-2',
					};
				}

				if (token === 'page-2') {
					return {
						Contents: [{ Key: 'mdx/three.mdx' }],
						IsTruncated: false,
					};
				}
			}

			if (typeof input.Key === 'string') {
				fetchedKeys.push(input.Key);
				return {
					Body: {
						transformToString: async () => `content:${input.Key}`,
					},
				};
			}

			throw new Error('unexpected AWS command');
		};

		vi.resetModules();
		const mod = await import('../s3');
		await mod.initMdxCache();

		expect(listedTokens).toEqual([undefined, 'page-2']);
		expect(fetchedKeys.sort()).toEqual(['mdx/one.mdx', 'mdx/three.mdx', 'mdx/two.mdx']);
		expect(mod.getMdxCache().get('mdx/three.mdx')).toBe('content:mdx/three.mdx');
		expect(mod.getMdxCache().has('mdx/skip.txt')).toBe(false);
	});
});
