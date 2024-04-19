import { useEffect, useState } from '@wordpress/element';
import { useTasksStore } from '@assist/state/tasks';

const { frontPage } = window.extSharedData || {};

export const LinkButton = ({ task, completed }) => {
	const [link, setLink] = useState(
		task.slug === 'edit-homepage' ? null : task.link,
	);
	const { completeTask } = useTasksStore();

	useEffect(() => {
		if (task.slug === 'edit-homepage') {
			const split = task.link.split('$');
			setLink(`${split[0]}${frontPage}${split[1]}`);
		}
	}, [task, setLink]);

	return (
		<a
			className="px-4 py-2.5 cursor-pointer  leading-tight text-sm font-medium text-center no-underline bg-design-main text-design-text rounded-sm hover:opacity-90"
			href={window.extSharedData.adminUrl + link}
			onClick={() => completeTask(task.slug)}>
			{completed ? task.buttonLabels.completed : task.buttonLabels.notCompleted}
		</a>
	);
};
