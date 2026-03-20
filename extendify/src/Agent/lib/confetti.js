import confetti from 'canvas-confetti';

let confettiInstance = null;

const ensureConfettiInstance = () => {
	if (confettiInstance) return confettiInstance;

	// Custom canvas to account for height issues
	const canvas = document.createElement('canvas');
	canvas.style.position = 'fixed';
	canvas.style.top = '0';
	canvas.style.left = '0';
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.pointerEvents = 'none';
	canvas.style.zIndex = Number.MAX_SAFE_INTEGER;
	document.body.appendChild(canvas);

	confettiInstance = confetti.create(canvas, {
		disableForReducedMotion: true,
		resize: true,
	});
	return confettiInstance;
};

export const throwSideConfetti = () => {
	const LEFT = {
		count: 200,
		defaults: {
			origin: { y: 0.7, x: 0 },
		},
		shots: [
			{ ratio: 0.25, spread: 26, startVelocity: 55 },
			{ ratio: 0.2, spread: 60 },
			{ ratio: 0.35, spread: 100, decay: 0.91, scalar: 0.8 },
			{ ratio: 0.1, spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 },
			{ ratio: 0.1, spread: 120, startVelocity: 45 },
		],
	};
	throwConfetti(LEFT);
	throwConfetti({
		...LEFT,
		defaults: {
			origin: { y: 0.7, x: 1 },
		},
	});
};

const throwConfetti = (config) => {
	const { count = 1, defaults, shots } = config;
	const shoot = ensureConfettiInstance();

	shots.forEach(({ ratio = 1, ...opts }) => {
		shoot({
			...(defaults ?? {}),
			...(opts ?? {}),
			particleCount: Math.floor(count * ratio),
			zIndex: Number.MAX_SAFE_INTEGER,
		});
	});
};
