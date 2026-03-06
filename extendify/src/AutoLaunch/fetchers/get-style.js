import { getThemeVariation } from '@auto-launch/fetchers/get-variation';
import { getStyleShape, styleShape } from '@auto-launch/fetchers/shape';
import {
	failWithFallback,
	fetchWithTimeout,
	retryTwice,
	setStatus,
} from '@auto-launch/functions/helpers';
import { updateOption } from '@auto-launch/functions/wp';
import { AI_HOST } from '@constants';
import { reqDataBasics } from '@shared/lib/data';
import { __ } from '@wordpress/i18n';
import { z } from 'zod';

const fallback = { siteStyle: {} };
const url = `${AI_HOST}/api/styles`;
const method = 'POST';
const headers = { 'Content-Type': 'application/json' };

// variation gets merged in after fetch
const shapeLocal = z.array(styleShape.omit({ variation: true }));

export const handleSiteStyle = async ({ siteProfile }) => {
	// translators: this is for a action log UI. Keep it short
	setStatus(__('Picking the perfect design', 'extendify-local'));

	const body = JSON.stringify({ ...reqDataBasics, siteProfile, count: 1 });

	const response = await retryTwice(() =>
		fetchWithTimeout(url, { method, headers, body }, 20_000),
	);

	if (!response?.ok) return fallback;

	return failWithFallback(async () => {
		const data = await response.json();
		const style = shapeLocal.parse(data)[0];
		const variation = await getThemeVariation(
			{
				slug: style.colorPalette,
				fonts: style.fonts,
			},
			{ fallback: true },
		);
		const siteStyle = { ...style, variation };
		await updateOption('extendify_site_style', siteStyle);
		// Set animation default
		await updateOption('extendify_animation_settings', {
			type: style.animation ?? 'fade',
			speed: 'medium',
		});
		return getStyleShape.parse({ siteStyle });
	}, fallback);
};
