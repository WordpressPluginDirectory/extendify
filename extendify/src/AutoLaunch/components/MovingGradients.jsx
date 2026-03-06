import { useMemo } from '@wordpress/element';
import { colord } from 'colord';
import { motion, useReducedMotion, useTime, useTransform } from 'framer-motion';

export const MovingGradient = () => {
	const time = useTime();
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
			.alpha(0.25)
			.toRgbString();
	}, [bannerMain]);

	const isLight = useMemo(() => colord(bannerMain).isLight(), [bannerMain]);

	const designMain = useMemo(() => {
		return getComputedStyle(document.documentElement)
			.getPropertyValue('--ext-design-main')
			.trim();
	}, []);

	const mainColorLike = useMemo(() => {
		return colord(designMain).desaturate(0.3).alpha(0.25).toRgbString();
	}, [designMain]);

	// stable per-mount random start, 0..1
	const phase = useMemo(() => Math.random(), []);
	const t = useTransform(time, (ms) => (ms / 24000 + phase) % 1);

	const x = useTransform(t, (v) => Math.sin(v * Math.PI * 2) * 180);
	const y = useTransform(t, (v) => Math.cos(v * Math.PI * 2) * 180);

	if (shouldReduceMotion) return null;

	if (isLight) {
		return (
			<motion.div
				style={{
					background: `radial-gradient(circle at center, ${mainColorLike}, transparent 40%)`,
					x,
					y,
				}}
				className="pointer-events-none absolute inset-0 h-full w-full scale-200"
			/>
		);
	}

	return (
		<motion.div
			style={{
				background: `radial-gradient(circle at center, ${bannerMainWashed}, transparent 40%)`,
				x,
				y,
			}}
			className="pointer-events-none absolute inset-0 h-full w-full scale-200"
		/>
	);
};
