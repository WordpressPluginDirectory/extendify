import { useMemo } from '@wordpress/element';
import { colord } from 'colord';
import { motion, useReducedMotion } from 'framer-motion';

export const ViewportPulse = () => {
	const shouldReduceMotion = useReducedMotion();
	const bannerMain = useMemo(() => {
		return getComputedStyle(document.documentElement)
			.getPropertyValue('--ext-banner-main')
			.trim();
	}, []);

	const bannerMainWashed = useMemo(() => {
		return colord(bannerMain)
			.desaturate(0.3)
			.lighten(0.4)
			.alpha(0.2)
			.toRgbString();
	}, [bannerMain]);

	const isLight = useMemo(() => colord(bannerMain).isLight(), [bannerMain]);

	const designMain = useMemo(() => {
		return getComputedStyle(document.documentElement)
			.getPropertyValue('--ext-design-main')
			.trim();
	}, []);

	const mainColorLike = useMemo(() => {
		return colord(designMain).desaturate(0.3).alpha(0.2).toRgbString();
	}, [designMain]);

	if (shouldReduceMotion) return null;

	const colorToUse = isLight ? mainColorLike : bannerMainWashed;
	return (
		<motion.div
			className="absolute inset-0"
			style={{
				background: `radial-gradient(ellipse at center, transparent 70%, ${colorToUse} 100%)`,
			}}
			animate={{ opacity: [0, 1, 0] }}
			transition={{
				duration: 2.5,
				repeatDelay: 4,
				repeat: Infinity,
				ease: 'linear',
			}}
		/>
	);
};
