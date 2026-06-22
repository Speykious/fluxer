// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/channel/components/Poll.module.css';
import Emoji from '@app/features/emoji/state/Emoji';
import {Button} from '@app/features/ui/button/Button';
import {Checkbox} from '@app/features/ui/checkbox/Checkbox';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import type {MessagePoll, MessagePollEmoji} from '@fluxer/schema/src/domains/message/PollSchemas';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react';
import {observer} from 'mobx-react-lite';
import {useMemo, useState} from 'react';

const SELECT_ONE_ANSWER_DESCRIPTOR = msg({
	message: 'Select one answer',
	comment: 'Small explanatory text instructing the user to select one answer on the poll.',
});
const SELECT_ONE_OR_MULTIPLE_ANSWERS_DESCRIPTOR = msg({
	message: 'Select one or multiple answers',
	comment: 'Small explanatory text instructing the user to select one or multiple answers on the poll.',
});
const GO_BACK_TO_VOTE_DESCRIPTOR = msg({
	message: 'Go back to vote',
	comment: 'Label of the button to go back to vote when the user is looking at poll results.',
});
const REMOVE_VOTE_DESCRIPTOR = msg({
	message: 'Remove vote',
	comment: "Label of the button to remove the user's vote.",
});
const VOTE_DESCRIPTOR = msg({
	message: 'Vote',
	comment: 'Label of the vote button.',
});
const SHOW_RESULTS_DESCRIPTOR = msg({
	message: 'Show results',
	comment: 'Label of the button to show poll answer results.',
});

function renderPollEmoji(pollEmoji?: MessagePollEmoji) {
	if (!pollEmoji?.id) return undefined;
	const emoji = Emoji.getEmojiById(pollEmoji.id);
	if (!emoji) return undefined;
	return <img src={emoji.url} alt={emoji.name} width="24" height="24" data-flx="poll.answer.emoji.img" />;
}

interface PollProps {
	poll: MessagePoll;
	onVote?: (selectedAnswers: Array<number>) => void;
}

export const Poll = observer((props: PollProps) => {
	const poll = props.poll;
	const {i18n} = useLingui();

	const [selectedAnswers, setSelectedAnswers] = useState<Array<number>>([]);
	const [isVoting, setIsVoting] = useState(false);
	const [isViewingResults, setIsViewingResults] = useState(false);

	const totalVoteCount = useMemo(() => {
		let acc = 0;
		for (const answerCount of poll.results?.answer_counts ?? []) acc += answerCount.count ?? 0;
		return acc;
	}, [poll.results]);

	const answers = useMemo(() => {
		const answerCountById: Array<number> = [];

		return (poll.answers ?? []).map((answer) => {
			const votes = answerCountById[answer.answer_id ?? 0] ?? 0;
			return {
				id: answer.answer_id ?? 0,
				emoji: answer.poll_media?.emoji,
				text: answer.poll_media?.text ?? '',
				votes,
				percentage: totalVoteCount > 0 ? (votes * 100.0) / totalVoteCount : 0,
			};
		});
	}, [poll]);

	return (
		<div data-flx="poll" className={styles.pollContainer}>
			<h2 data-flx="poll.question">{poll.question?.text ?? ''}</h2>
			<p data-flx="poll.description">
				<small>
					{i18n._(poll.allow_multiselect ? SELECT_ONE_OR_MULTIPLE_ANSWERS_DESCRIPTOR : SELECT_ONE_ANSWER_DESCRIPTOR)}
				</small>
			</p>
			{answers.map((answer) => (
				<FocusRing offset={-2} data-flx="poll.answer.focus-ring">
					<button
						type="button"
						key={answer.id}
						className={styles.answerButton}
						onClick={() => {
							if (!(isVoting && !isViewingResults)) return;
							setSelectedAnswers((prevSelectedAnswers) =>
								poll.allow_multiselect
									? prevSelectedAnswers.find((prevId) => prevId === answer.id) !== undefined
										? prevSelectedAnswers.filter((prevId) => prevId !== answer.id)
										: [...prevSelectedAnswers, answer.id]
									: [answer.id],
							);
						}}
						data-voting={isVoting && !isViewingResults}
						data-checked={selectedAnswers.find((id) => id === answer.id) !== undefined}
						data-flx="poll.answer.button"
					>
						{isVoting && !isViewingResults ? (
							<Checkbox
								className={styles.answerCheckbox}
								type={poll.allow_multiselect ? 'box' : 'round'}
								checked={selectedAnswers.find((id) => id === answer.id) !== undefined}
								aria-hidden={true}
								data-flx="poll.answer.checkbox"
							/>
						) : undefined}
						<section className={styles.answerText} data-flx="poll.answer.section.text">
							{renderPollEmoji(answer.emoji)}
							<p data-flx="poll.answer.text">{answer.text}</p>
						</section>
						{isVoting && !isViewingResults ? undefined : (
							<section data-flx="poll.answer.section.votes">
								<p className={styles.answerVotes} data-flx="poll.answer.vote-count">
									{answer.votes} votes
								</p>
								<h2 className={styles.answerPercentage} data-flx="poll.answer.vote-percentage">
									{Math.round(answer.percentage)}%
								</h2>
							</section>
						)}
					</button>
				</FocusRing>
			))}
			<footer data-flx="poll.footer">
				<Button
					variant={isVoting ? 'primary' : 'secondary'}
					disabled={isViewingResults || (isVoting && selectedAnswers.length === 0)}
					onClick={() => {
						setIsVoting((prevIsVoting) => !prevIsVoting);
						if (!isVoting && props.onVote) props.onVote(selectedAnswers);
					}}
					data-flx="poll.footer.vote.button"
				>
					{i18n._(isVoting ? VOTE_DESCRIPTOR : REMOVE_VOTE_DESCRIPTOR)}
				</Button>
				<section>
					<p className={styles.answerVotes} data-flx="poll.footer.vote-count">
						{totalVoteCount} votes
					</p>
					<Button
						variant="secondary"
						onClick={() => setIsViewingResults((prevIsViewingResults) => !prevIsViewingResults)}
						data-flx="poll.footer.show-results.button"
					>
						{i18n._(isViewingResults ? GO_BACK_TO_VOTE_DESCRIPTOR : SHOW_RESULTS_DESCRIPTOR)}
					</Button>
				</section>
			</footer>
		</div>
	);
});
