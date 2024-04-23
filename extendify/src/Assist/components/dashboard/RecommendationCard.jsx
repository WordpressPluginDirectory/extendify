import { Button } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Icon, check, warning } from '@wordpress/icons';
import { installPlugin } from '@assist/api/WPApi';

export const RecommendationCard = ({ recommendation }) => {
	if (recommendation.pluginSlug) {
		return <InstallCard recommendation={recommendation} />;
	}
	return <LinkCard recommendation={recommendation} />;
};

const LinkCard = ({ recommendation }) => {
	const { by, description, image, title, linkType } = recommendation;

	if (!recommendation?.[linkType]) return null;

	return (
		<a
			href={recommendation[linkType]}
			target="_blank"
			rel="noopener noreferrer"
			className="border border-gray-200 p-4 rounded text-base h-48 lg:h-56 hover:bg-gray-50 hover:border-design-main cursor-pointer bg-transparent text-left no-underline">
			<div className="w-full h-full">
				<img
					className="h-8 w-8 rounded fill-current"
					alt={__('Logo for %s', 'extendify-local')}
					src={image}
				/>
				<div className="mt-2 font-semibold">{title}</div>
				{by && <div className="text-sm text-gray-700">{by}</div>}
				<div className="mt-2 text-sm text-gray-800">{description}</div>
			</div>
		</a>
	);
};

const InstallCard = ({ recommendation }) => {
	const { by, description, image, title, pluginSlug } = recommendation;

	return (
		<div className="border border-gray-200 p-4 rounded text-base h-48 lg:h-56 bg-transparent text-left">
			<div className="w-full h-full">
				<img
					className="h-8 w-8 rounded fill-current"
					alt={__('Logo for %s', 'extendify-local')}
					src={image}
				/>
				<div className="mt-2 font-semibold">{title}</div>
				{by && <div className="text-sm text-gray-700">{by}</div>}
				<div className="mt-2 mb-3 text-sm text-gray-800">{description}</div>
				<InstallButton pluginSlug={pluginSlug} />
			</div>
		</div>
	);
};

const InstallButton = ({ pluginSlug }) => {
	const [installing, setInstalling] = useState(false);
	const [status, setStatus] = useState('');

	useEffect(() => {
		const { installedPlugins, activePlugins } = window.extSharedData;
		const hasPlugin = (p) => p?.includes(pluginSlug);
		const installed = Object.values(installedPlugins).some(hasPlugin);
		const active = Object.values(activePlugins).some(hasPlugin);
		if (installed) setStatus('inactive');
		if (active) setStatus('active');
	}, [pluginSlug, setStatus]);

	const handleClick = async () => {
		setInstalling(true);
		try {
			await installPlugin(pluginSlug);
			setStatus('active');
		} catch {
			setStatus('error');
			setTimeout(() => {
				setStatus(status);
			}, 1500);
		}
		setInstalling(false);
	};

	if (status === 'error') {
		return (
			<>
				<p
					className="flex items-center text-wp-alert-red fill-wp-alert-red"
					style={{ fontSize: '13px' }}>
					<Icon icon={warning} />
					{__('Error', 'extendify-local')}
				</p>
			</>
		);
	}

	if (status === 'active') {
		return (
			<>
				<p
					className="flex items-center text-wp-alert-green fill-wp-alert-green"
					style={{ fontSize: '13px' }}>
					<Icon icon={check} />
					{__('Active', 'extendify-local')}
				</p>
			</>
		);
	}

	if (status === 'inactive') {
		return (
			<Button
				onClick={handleClick}
				type="button"
				variant="secondary"
				size="compact"
				disabled={installing}
				isBusy={installing}>
				{installing
					? __('Activating...', 'extendify-local')
					: __('Activate', 'extendify-local')}
			</Button>
		);
	}

	return (
		<Button
			onClick={handleClick}
			type="button"
			variant="secondary"
			size="compact"
			disabled={installing}
			isBusy={installing}>
			{installing
				? __('Installing...', 'extendify-local')
				: __('Install Now', 'extendify-local')}
		</Button>
	);
};
