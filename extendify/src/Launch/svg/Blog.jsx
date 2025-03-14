import { memo } from '@wordpress/element';

const Blog = (props) => {
	const { className, ...otherProps } = props;

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 -960 960 960"
			className={className}
			{...otherProps}>
			<path d="M157.69-140q-23.53 0-40.61-17.08T100-197.69v-564.62q0-23.53 17.08-40.61T157.69-820h644.62q23.53 0 40.61 17.08T860-762.31v564.62q0 23.53-17.08 40.61T802.31-140H157.69Zm0-45.39h644.62q4.61 0 8.46-3.84 3.84-3.85 3.84-8.46v-564.62q0-4.61-3.84-8.46-3.85-3.84-8.46-3.84H157.69q-4.61 0-8.46 3.84-3.84 3.85-3.84 8.46v564.62q0 4.61 3.84 8.46 3.85 3.84 8.46 3.84Zm104.39-114.46h435.84v-45.38H262.08v45.38Zm0-159.07h143.84v-201.23H262.08v201.23Zm249 0h186.84v-45.39H511.08v45.39Zm0-155.85h186.84v-45.38H511.08v45.38ZM145.39-185.39v-589.22 589.22Z" />
		</svg>
	);
};

export default memo(Blog);
