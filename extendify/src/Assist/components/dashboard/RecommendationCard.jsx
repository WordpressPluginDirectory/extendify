import { useEffect, useState } from '@wordpress/element';

export const RecommendationCard = ({ recommendation }) => {
	const [link, setLink] = useState();
	const { by, description, image, title, linkType, adminUrl } = recommendation;

	useEffect(() => {
		setLink(recommendation[linkType]);
	}, [setLink, recommendation, linkType]);

	const handleClick = () => {
		if (linkType === 'externalLink') return window.open(link);

		return (window.location = `${adminUrl}${link}`);
	};

	return (
		<button
			onClick={handleClick}
			className="border border-gray-200 p-4 rounded text-base h-48 lg:h-56 hover:bg-gray-50 hover:border-design-main cursor-pointer bg-transparent text-left">
			<div className="w-full h-full">
				<img className="h-8 w-8 rounded fill-current" alt={title} src={image} />
				<div className="mt-2 font-semibold">{title}</div>
				{by && <div className="text-sm text-gray-700">{by}</div>}
				<div className="mt-2 text-sm text-gray-800">{description}</div>
			</div>
		</button>
	);
};
