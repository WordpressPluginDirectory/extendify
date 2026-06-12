import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { useEffect, useState } from '@wordpress/element';
import { isEmail } from '@wordpress/url';
import { pluginsActivation } from '../../api/pluginsActivation';
import { Loading } from './Loading';
import { SetupComplete } from './SetupComplete';
import { SetupPlugins } from './SetupPlugins';
import {
	ACTIVATION_STATUS,
	usePluginsActivation,
} from './usePluginsActivation';

async function createAccount(plugin, data) {
	if (!plugin?.idempotent) {
		const signal = AbortSignal.timeout(10000);
		const attemptStart = Date.now();

		try {
			await plugin.createAccountCallback({ ...data, signal });

			return {
				requestTimeInMs: [Date.now() - attemptStart],
				retries: 0,
				errors: [],
			};
		} catch (error) {
			const err = new Error('Single attempt failed');

			err.requestTimeInMs = [Date.now() - attemptStart];
			err.retries = 0;
			err.errors = error?.message ? [error.message] : [];

			throw err;
		}
	}

	return createAccountWithRetry(plugin, data);
}

/**
 * Attempts account creation with retry logic within a 10s window.
 * Retries immediately on timeout (5s), or after 2.5s on other failures.
 */
async function createAccountWithRetry(
	plugin,
	{ email, marketingConsent, termsAgreed, scriptData },
) {
	const windowMs = 10000;
	const perAttemptMs = 5000;
	const backoffMs = 2500;
	const maxRetries = 5;

	const windowStart = Date.now();
	const requestTimeInMs = [];
	const errors = [];
	let retries = 0;

	while (Date.now() - windowStart < windowMs && retries < maxRetries) {
		const attemptStart = Date.now();
		const signal = AbortSignal.timeout(perAttemptMs);

		try {
			await plugin.createAccountCallback({
				email,
				marketingConsent,
				termsAgreed,
				scriptData,
				signal,
			});
			requestTimeInMs.push(Date.now() - attemptStart);
			return { requestTimeInMs, retries, errors };
		} catch (error) {
			requestTimeInMs.push(Date.now() - attemptStart);
			if (error?.message) errors.push(error.message);

			const isTimeout = signal.aborted;
			const remainingMs = windowMs - (Date.now() - windowStart);

			if (remainingMs <= 0) break;

			retries++;

			if (!isTimeout && remainingMs >= backoffMs) {
				await new Promise((resolve) => setTimeout(resolve, backoffMs));
			}
		}
	}

	const err = new Error(`Retry window of ${windowMs}ms exceeded`);
	err.requestTimeInMs = requestTimeInMs;
	err.retries = retries;
	err.errors = errors;
	throw err;
}

export const ProductAccountActivation = () => {
	const [isOpen, setIsOpen] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const [isFinished, setIsFinished] = useState(false);
	const [plugins, setPlugins] = useState(
		(window.extSharedData?.showProductActivation ?? [])
			.map((pluginData) => ({
				...pluginData,
				selected: true,
				createAccountCallback:
					pluginsActivation[pluginData.slug]?.createAccountCallback ?? null,
				idempotent: pluginsActivation[pluginData.slug]?.idempotent ?? true,
			}))
			.filter((plugin) => plugin.createAccountCallback),
	);

	const [email, setEmail] = useState(window.extSharedData?.userEmail ?? '');
	const [marketingConsent, setMarketingConsent] = useState(false);
	const [termsAgreed, setTermsAgreed] = useState(false);
	const { scriptData, activatePlugins } = usePluginsActivation(plugins);

	useEffect(() => {
		const style = document.createElement('style');
		style.textContent = '.grecaptcha-badge { visibility: hidden; }';
		document.head.appendChild(style);
	}, []);

	const handleClose = () => {
		activatePlugins({
			status: ACTIVATION_STATUS.skipped,
		});
		setIsOpen(false);
	};

	const handleCreateAccounts = async () => {
		if (!isEmail(email)) return;

		setIsLoading(true);

		const selectedPlugins = plugins?.filter((plugin) => plugin.selected) ?? [];

		const results = await Promise.allSettled(
			selectedPlugins.map((plugin) =>
				createAccount(plugin, {
					email,
					marketingConsent,
					termsAgreed,
					scriptData: scriptData?.[plugin.slug],
				}),
			),
		);

		const context = Object.fromEntries(
			selectedPlugins.map((plugin, index) => {
				const result = results[index];
				const { requestTimeInMs, retries, errors } =
					result.status === 'fulfilled' ? result.value : result.reason;
				const entry = {
					status: result.status === 'fulfilled' ? 'success' : 'error',
					requestTimeInMs,
					endpoint: `extendify/v1/${plugin.slug}/create-account`,
					retries,
					...(errors.length > 0 && { errors }),
				};
				return [plugin.slug, entry];
			}),
		);

		await activatePlugins({
			status: ACTIVATION_STATUS.completed,
			context,
		});

		setIsFinished(true);
		setIsLoading(false);
	};

	return (
		plugins?.length && (
			<Dialog
				open={isOpen}
				onClose={() => {}}
				className="relative z-high extendify-shared"
			>
				<DialogBackdrop
					transition
					className="fixed inset-0 bg-black/30 transition-opacity data-closed:opacity-0"
				/>

				<div className="z-10 fixed inset-0 flex w-screen items-center justify-center p-4 [body:has(#extendify-agent-chat)_&]:ml-96 [body:has(#extendify-agent-chat)_&]:w-[calc(100%-24rem)]">
					<DialogPanel
						transition
						className="relative w-full max-w-208 bg-white rounded-lg shadow-xl transition-all data-closed:opacity-0 data-closed:scale-95"
					>
						{!isFinished && !isLoading && (
							<SetupPlugins
								plugins={plugins}
								setPlugins={setPlugins}
								handleCreateAccounts={handleCreateAccounts}
								email={email}
								setEmail={setEmail}
								handleClose={handleClose}
								marketingConsent={marketingConsent}
								setMarketingConsent={setMarketingConsent}
								termsAgreed={termsAgreed}
								setTermsAgreed={setTermsAgreed}
							/>
						)}

						{!isFinished && isLoading && <Loading />}

						{isFinished && (
							<SetupComplete handleClose={() => setIsOpen(false)} />
						)}
					</DialogPanel>
				</div>
			</Dialog>
		)
	);
};
