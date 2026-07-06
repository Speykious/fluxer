// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import type {Guild} from '@app/features/guild/models/Guild';
import GuildMembers from '@app/features/member/state/GuildMembers';
import * as PollCommands from '@app/features/messaging/commands/PollCommands';
import {Avatar} from '@app/features/ui/components/Avatar';
import {Scroller} from '@app/features/ui/components/Scroller';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import type {User} from '@app/features/user/models/User';
import Users from '@app/features/user/state/Users';
import type {MessagePoll} from '@fluxer/schema/src/domains/message/PollSchemas';
import {useLingui} from '@lingui/react';
import {observer} from 'mobx-react-lite';
import {useMemo, useState} from 'react';
import {PreloadableUserPopout} from '../PreloadableUserPopout';
import * as styles from './PollAnswerVotersModal.module.css';

interface PollAnswerVotersModalProps {
	guild?: Guild;
	channelId: string;
	messageId: string;
	poll: MessagePoll;
    initialAnswerId: number;
}

interface Voter {
	nickname?: string;
	username: string;
	tag: string;
	user: User;
}

export const PollAnswerVotersModal = observer(({guild, channelId, messageId, poll, initialAnswerId}: PollAnswerVotersModalProps) => {
	const {i18n} = useLingui();
	const [selectedAnswer, setSelectedAnswer] = useState(initialAnswerId);

	const answerVoteArray = useMemo(() => {
		const array = [];
		for (const answerCount of poll.results?.answer_counts ?? []) {
			array[answerCount.id ?? 0] = answerCount.count ?? 0;
		}
		return array;
	}, [poll.results]);

	const totalVotes = useMemo(() => {
		let total = 0;
		for (const answerCount of poll.results?.answer_counts ?? []) {
			total += answerCount.count ?? 0;
		}
		return total;
	}, [poll.results]);

	const [voters, setVoters] = useState<Array<Voter>>([]);

	useMemo(async () => {
		setVoters(
			(await PollCommands.fetchAnswerVoters(i18n, channelId, messageId, selectedAnswer))
				.map((voter) => {
					if (guild) {
						const member = GuildMembers.getMember(guild.id, voter.id);
						if (!member) return undefined;

						return {
							avatar: member.avatar ?? undefined,
							nickname: member.nick ?? member.user.username,
							username: member.user.username,
							tag: member.user.tag,
							user: member.user,
						};
					} else {
						const user = Users.getUser(voter.id);
						if (!user) return undefined;

						return {
							avatar: user.avatar ?? undefined,
							username: user.username,
							tag: user.tag,
							user,
						};
					}
				})
				.filter((voter) => voter !== undefined),
		);
	}, [selectedAnswer, i18n, channelId, messageId]);

	return (
		<Modal.Root size="medium" centered data-flx="messaging.poll-answer-voters-modal.modal-root">
			<Modal.Header title={poll.question?.text ?? ''} data-flx="messaging.poll-answer-voters-modal.modal-header">
				<div className={styles.smallText} data-flx="messaging.poll-answer-voters-modal.modal-header.total-votes">
					{totalVotes} votes
				</div>
			</Modal.Header>
			<div className={styles.contentSplit} data-flx="messaging.poll-answer-voters-modal.content-split">
				<div className={styles.answerList} data-flx="messaging.poll-answer-voters-modal.answer-list">
					<Scroller
						className={styles.scrollerPadding}
						contentClassName={styles.scrollerContent}
						data-flx="messaging.poll-answer-voters-modal.answer-list.scroller"
					>
						{(poll.answers ?? []).map((answer) => (
							<button
								type="button"
								className={styles.answer}
								data-selected={answer.answer_id === selectedAnswer}
								onClick={() => setSelectedAnswer(answer.answer_id ?? 0)}
								data-flx="messaging.poll-answer-voters-modal.answer.button"
							>
								<div className={styles.answerText} data-flx="messaging.poll-answer-voters-modal.answer.text">
									{answer.poll_media?.text ?? ''}
								</div>
								<div className={styles.smallText} data-flx="messaging.poll-answer-voters-modal.answer.votes">
									{answerVoteArray[answer.answer_id ?? 0]} votes
								</div>
							</button>
						))}
						<div className={styles.scrollerVoid} />
					</Scroller>
				</div>
				<div className={styles.voterList}>
					<Scroller
						className={styles.scrollerPadding}
						contentClassName={styles.scrollerContent}
						data-flx="messaging.poll-answer-voters-modal.voter-list.scroller"
					>
						{voters.map((voter) => (
							<PreloadableUserPopout
								user={voter.user}
								isWebhook={false}
								guildId={guild?.id}
								channelId={channelId}
								enableLongPressActions={false}
								data-flx="channel.message-avatar.preloadable-user-popout"
							>
								<FocusRing data-flx="channel.message-avatar.focus-ring">
									<div className={styles.voter}>
										<Avatar user={voter.user} guildId={guild?.id} size={32} />
										<div>
											<div>{voter.nickname}</div>
											<div className={styles.smallText}>{voter.tag}</div>
										</div>
									</div>
								</FocusRing>
							</PreloadableUserPopout>
						))}
					</Scroller>
				</div>
			</div>
		</Modal.Root>
	);
});
