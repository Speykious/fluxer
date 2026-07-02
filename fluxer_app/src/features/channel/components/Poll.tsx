// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/channel/components/Poll.module.css';
import Emoji from '@app/features/emoji/state/Emoji';
import {Button} from '@app/features/ui/button/Button';
import {Checkbox} from '@app/features/ui/checkbox/Checkbox';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import type {
	MessagePoll,
	MessagePollAnswerCount,
	MessagePollEmoji,
} from '@fluxer/schema/src/domains/message/PollSchemas';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react';
import { CheckCircleIcon } from '@phosphor-icons/react';
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
	messageState: string;
	onVote?: (add: boolean, selectedAnswers: Array<number>) => void;
}

export const Poll = observer((props: PollProps) => {
	const poll = props.poll;
	const {i18n} = useLingui();

	const isSent = props.messageState === 'SENT';

	const answerCounts = props.poll.results?.answer_counts ?? [];
	const hasVoted = answerCounts.find((answerCount) => answerCount.me_voted) !== undefined;

	const [selectedAnswers, setSelectedAnswers] = useState<Array<number>>(
		answerCounts
			.filter((answerCount) => answerCount.id !== undefined && answerCount.me_voted)
			.map((answerCount) => answerCount.id ?? 0)
	);
	const [isVoting, setIsVoting] = useState(!hasVoted);
	const [isViewingResults, setIsViewingResults] = useState(false);

	const [now, setNow] = useState(Date.now());

	const totalVoteCount = useMemo(() => {
		let acc = 0;
		for (const answerCount of poll.results?.answer_counts ?? []) acc += answerCount.count ?? 0;
		return acc;
	}, [poll.results]);

	const secondsLeft = useMemo(() => {
		if (!poll.expiry) return 0;

		const expiryUts = Date.parse(poll.expiry) / 1000;
		const nowUts = now / 1000;

		return expiryUts - nowUts;
	}, [poll.expiry, now]);

	const isFinalized = useMemo(() => poll.results?.is_finalized, [poll]);
	const inVoteScreen = useMemo(
		() => isVoting && !isViewingResults && !isFinalized,
		[isVoting, isViewingResults, isFinalized],
	);

	if (secondsLeft > 0 && !isFinalized) {
		setTimeout(
			() => setNow(Date.now()),
			secondsLeft < 1.5 * 3600 ? 60_000 : secondsLeft < 1.5 * 86400 ? 3600_000 : 86400_000,
		);
	}

	function timeLeft(secondsLeft: number): string {
		// TODO: localize
		if (secondsLeft < 60) return `<1m left`;
		if (secondsLeft < 3600) return `${Math.round(secondsLeft / 60)}m left`;
		if (secondsLeft < 86400) return `${Math.round(secondsLeft / 3600)}h left`;
		return `${Math.floor(secondsLeft / 86400)}d left`;
	}

	const answers = useMemo(() => {
		const answerCountById: Array<MessagePollAnswerCount> = [];
		for (const answerCount of poll.results?.answer_counts ?? []) {
			if (answerCount) answerCountById[answerCount.id ?? 0] = answerCount;
		}

		const answers = (poll.answers ?? []).map((answer) => {
			const votes = answerCountById[answer.answer_id ?? 0] ?? 0;
			return {
				id: answer.answer_id ?? 0,
				emoji: answer.poll_media?.emoji,
				text: answer.poll_media?.text ?? '',
				me: votes.me_voted ?? false,
				votes: votes.count ?? 0,
				percentage: totalVoteCount > 0 ? ((votes.count ?? 0) * 100.0) / totalVoteCount : 0,
				winner: false,
			};
		});

		if (isFinalized) {
			let maxPercentage = 0;
			for (const answer of answers) maxPercentage = Math.max(maxPercentage, answer.percentage);

			if (maxPercentage > 0) {
				for (const answer of answers) {
					if (answer.percentage === maxPercentage) answer.winner = true;
				}
			}
		}

		return answers;
	}, [poll]);

	return (
		<div data-flx="poll" className={styles.pollContainer} data-open={!isFinalized} data-state={props.messageState}>
			<h2 data-flx="poll.question">{poll.question?.text ?? ''}</h2>
			<p data-flx="poll.description">
				<small>
					{i18n._(poll.allow_multiselect ? SELECT_ONE_OR_MULTIPLE_ANSWERS_DESCRIPTOR : SELECT_ONE_ANSWER_DESCRIPTOR)}
				</small>
			</p>
			{answers.map((answer) => (
				<FocusRing offset={-2} enabled={inVoteScreen} data-flx="poll.answer.focus-ring">
					<button
						type="button"
						key={answer.id}
						className={styles.answerButton}
						disabled={!isSent}
						onClick={() => {
							if (!inVoteScreen) return;
							setSelectedAnswers((prevSelectedAnswers) =>
								poll.allow_multiselect
									? prevSelectedAnswers.find((prevId) => prevId === answer.id) !== undefined
										? prevSelectedAnswers.filter((prevId) => prevId !== answer.id)
										: [...prevSelectedAnswers, answer.id]
									: [answer.id],
							);
						}}
						data-variant={answer.winner ? 'winner' : answer.me ? (isFinalized ? 'me-finalized' : 'me') : undefined}
						data-voting={inVoteScreen}
						data-checked={answer.me}
						data-flx="poll.answer.button"
					>
						{inVoteScreen ? undefined : (
							<div
								className={styles.answerPercentageBar}
								style={{
									width: `${Math.round(answer.percentage)}%`,
								}}
								data-flx="poll.answer.bar"
							/>
						)}
						<div className={styles.answerLayout}>
							{inVoteScreen ? (
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
							{inVoteScreen ? undefined : (
								<section data-flx="poll.answer.section.votes">
									<p className={styles.answerVotes} data-flx="poll.answer.vote-count">
										{answer.votes} votes
									</p>
									<h2 className={styles.answerPercentage} data-flx="poll.answer.vote-percentage">
										{Math.round(answer.percentage)}%
									</h2>
									{answer.me ? <CheckCircleIcon weight="fill" className={styles.answerMeSuccess} data-flx="poll.answer.me-check" /> : undefined}
								</section>
							)}
						</div>
					</button>
				</FocusRing>
			))}
			<footer data-flx="poll.footer">
				{isFinalized ? undefined : (
					<Button
						variant={isVoting ? 'primary' : 'secondary'}
						disabled={isViewingResults || (isVoting && selectedAnswers.length === 0) || !isSent}
						onClick={() => {
							setIsVoting((prevIsVoting) => !prevIsVoting);
							if (props.onVote) props.onVote(isVoting, selectedAnswers);
						}}
						data-flx="poll.footer.vote.button"
					>
						{i18n._(isVoting ? VOTE_DESCRIPTOR : REMOVE_VOTE_DESCRIPTOR)}
					</Button>
				)}
				<section>
					<p className={styles.answerVotes} data-flx="poll.footer.vote-count">
						{isFinalized ? 'Poll closed' : poll.expiry ? timeLeft(secondsLeft) : 'Poll not sent'} ·{' '}
						{totalVoteCount} votes
					</p>
					{isFinalized || !isVoting ? undefined : (
						<Button
							variant="secondary"
							disabled={!isSent}
							onClick={() => setIsViewingResults((prevIsViewingResults) => !prevIsViewingResults)}
							data-flx="poll.footer.show-results.button"
						>
							{i18n._(isViewingResults ? GO_BACK_TO_VOTE_DESCRIPTOR : SHOW_RESULTS_DESCRIPTOR)}
						</Button>
					)}
				</section>
			</footer>
		</div>
	);
});
