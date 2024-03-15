import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import classNames from 'classnames';
import { useTasksStore } from '@assist/state/tasks';

export const UpdateSiteDescription = ({ popModal, setModalTitle }) => {
	const [siteDescription, setSiteDescription] = useState(undefined);
	const [initialValue, setInitialValue] = useState(undefined);
	const inputRef = useRef();
	const { completeTask } = useTasksStore();

	const submitChange = async () => {
		await apiFetch({
			path: '/wp/v2/settings',
			method: 'POST',
			data: {
				description: siteDescription,
			},
		});
		completeTask('site-description');
		popModal();
	};

	useEffect(() => {
		setModalTitle(__('Add site description', 'extendify-local'));
	}, [setModalTitle]);

	useEffect(() => {
		const controller = new AbortController();

		apiFetch({
			path: '/wp/v2/settings',
			signal: controller.signal,
		}).then((settings) => {
			setSiteDescription(settings.description);
			setInitialValue(settings.description);
		});

		return () => controller.abort();
	}, [setSiteDescription]);

	useEffect(() => {
		inputRef?.current?.focus();
	}, [initialValue]);

	if (typeof siteDescription === 'undefined') {
		return <div className="h-32">{__('Loading...', 'extendify-local')}</div>;
	}

	return (
		<form className="gap-6 flex flex-col" onSubmit={(e) => e.preventDefault()}>
			<div>
				<label
					className="block mb-1 text-gray-900 text-sm"
					htmlFor="extendify-site-description-input">
					{__('Site description', 'extendify-local')}
				</label>
				<input
					ref={inputRef}
					type="text"
					name="extendify-site-description-input"
					id="extendify-site-description-input"
					className="w-96 max-w-full border border-gray-900 px-2 h-12 input-focus"
					onChange={(e) => {
						setSiteDescription(e.target.value);
					}}
					value={siteDescription}
					placeholder={__('Enter a site description...', 'extendify-local')}
				/>
			</div>
			<div>
				<button
					disabled={siteDescription === initialValue}
					className={classNames(
						'px-4 py-3 text-white bg-design-main button-focus border-0 rounded relative cursor-pointer w-1/5',
						{
							'opacity-50 cursor-default': siteDescription === initialValue,
						},
					)}
					onClick={submitChange}>
					{__('Save', 'extendify-local')}
				</button>
			</div>
		</form>
	);
};
