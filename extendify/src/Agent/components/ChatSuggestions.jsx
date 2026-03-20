import { sparkle } from '@agent/icons';
import { useSuggestionsStore } from '@agent/state/suggestions';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	chevronRight,
	drafts,
	help,
	pencil,
	published,
	siteLogo,
	styles,
	swatch,
	typography,
	video,
} from '@wordpress/icons';

const icons = {
	styles,
	edit: pencil,
	help,
	video,
	sparkle,
	drafts,
	published,
	typography,
	pencil,
	siteLogo,
	swatch,
};

export const ChatSuggestions = ({ suggestions }) => {
	const { markAsClicked, isAvailable, getSuggestions } = useSuggestionsStore();
	const [allSuggestions, setAllSuggestions] = useState(suggestions);

	const handleSubmit = (suggestion) => {
		window.dispatchEvent(
			new CustomEvent('extendify-agent:chat-submit', {
				detail: { message: suggestion.message },
			}),
		);
		markAsClicked(suggestion);
	};

	const handleShowMore = () => {
		const next = getSuggestions({ slice: 6, exclude: allSuggestions });
		setAllSuggestions((prev) => [...prev, ...next]);
	};

	if (!suggestions) return null;

	return (
		<>
			{allSuggestions.map((suggestion) => {
				// Hide them if it's not available to the user
				if (!isAvailable(suggestion)) return null;
				return (
					<SuggestionButton
						key={suggestion.message}
						suggestion={suggestion}
						handleSubmit={handleSubmit}
					/>
				);
			})}
			<ShowMoreButton handleShowMore={handleShowMore} />
		</>
	);
};

const SuggestionButton = ({ suggestion, handleSubmit }) => {
	const icon = icons[suggestion?.icon] ?? icons.sparkle;
	return (
		<button
			type="button"
			className="group flex items-center justify-between rounded-sm bg-transparent px-1 py-1 text-left text-sm not-italic text-gray-900 transition-colors duration-100 hover:bg-gray-100 focus:outline-hidden focus:ring-2 focus:ring-design-main"
			onClick={() => handleSubmit(suggestion)}
		>
			<div className="flex items-center gap-1.5 leading-none">
				<span className="h-5 w-5 shrink-0 self-start fill-gray-700">
					{icon}
				</span>
				<span className="leading-5">{suggestion.message}</span>
			</div>
			<span className="inline-block h-5 w-5 fill-gray-700 leading-none opacity-0 transition-opacity duration-100 group-hover:opacity-100 rtl:scale-x-[-1]">
				{chevronRight}
			</span>
		</button>
	);
};

const ShowMoreButton = ({ handleShowMore }) => {
	const [hide, setHide] = useState(false);
	const handleClick = () => {
		handleShowMore();
		setHide(true);
	};

	if (hide) return null;
	return (
		<button
			type="button"
			className="group flex w-full items-center gap-3 rounded-sm bg-transparent px-1 py-1 text-xs not-italic text-gray-800 transition-colors duration-100 hover:text-gray-900 focus:outline-hidden group"
			onClick={handleClick}
		>
			<span className="h-px flex-1 bg-gray-200" />
			<span className="group-hover:underline group-focus:ring-2 group-focus:ring-design-main">
				{__('Show more', 'extendify-local')}
			</span>
			<span className="h-px flex-1 bg-gray-200" />
		</button>
	);
};
