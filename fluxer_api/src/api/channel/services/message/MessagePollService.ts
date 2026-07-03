// SPDX-License-Identifier: AGPL-3.0-or-later

import type {Channel} from '@app/api/models/Channel';
import {Message} from '@app/api/models/Message';
import type {PollMessageExpiryRow} from '@app/api/Tables';
import {CannotEditOtherUserMessageError} from '@fluxer/errors/src/domains/channel/CannotEditOtherUserMessageError';
import {CannotVoteOnNonPollError} from '@fluxer/errors/src/domains/channel/CannotVoteOnNonPollError';
import {CannotSelectMultipleAnswersError} from '@fluxer/errors/src/domains/channel/CannotSelectMultipleAnswersError';
import {UnknownMessageError} from '@fluxer/errors/src/domains/channel/UnknownMessageError';
import type {ChannelID, MessageID, UserID} from '../../../BrandedTypes';
import type {IChannelRepositoryAggregate} from '../../repositories/IChannelRepositoryAggregate';
import type {PollMessageExpiryRepository} from '../../repositories/PollMessageExpiryRepository';
import type {MessageReactionService} from '../interaction/MessageReactionService';
import type {MessageChannelAuthService} from './MessageChannelAuthService';
import type {MessageDispatchService} from './MessageDispatchService';

interface MessagePollServiceDeps {
	channelAuthService: MessageChannelAuthService;
	channelRepository: IChannelRepositoryAggregate;
	dispatchService: MessageDispatchService;
	pollExpiryRepository: PollMessageExpiryRepository;
	messageReactionService: MessageReactionService;
	// guildAuditLogService: GuildAuditLogService;
}

export class MessagePollService {
	public readonly expiry: PollMessageExpiryRepository;

	constructor(private readonly deps: MessagePollServiceDeps) {
		this.expiry = deps.pollExpiryRepository;
	}

	async endPoll({
		userId,
		channelId,
		messageId,
		expiryRow,
		skipGuildAuditLog,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		skipGuildAuditLog?: boolean;
		expiryRow?: PollMessageExpiryRow;
	}): Promise<void> {
		const {channel} = await this.deps.channelAuthService.getChannelAuthenticated({
			userId,
			channelId,
		});
		const message = await this.deps.channelRepository.messages.getMessage(channel.id, messageId);
		if (message?.authorId !== userId) throw new CannotEditOtherUserMessageError();

		return await this.endPollSkipAuth({channel, message, expiryRow, skipGuildAuditLog});
	}

	async endPollSkipAuth({
		channel,
		message,
		expiryRow,
		// skipGuildAuditLog,
	}: {
		channel: Channel;
		message: Message | null;
		skipGuildAuditLog?: boolean;
		expiryRow?: PollMessageExpiryRow;
	}): Promise<void> {
		if (!message) throw new UnknownMessageError();
		if (!message.poll) throw new UnknownMessageError();

		const oldMessageRow = message.toRow();
		const newMessageRow = message.toRow();
		const poll = newMessageRow.poll;
		if (poll) {
			if (poll.results) {
				poll.results.is_finalized = true;
			} else {
				poll.results = {
					is_finalized: true,
					answer_counts: (poll.answers ?? []).map((answer) => ({
						id: answer.answer_id,
						count: 0,
					})),
				};
			}
		}

		await this.deps.channelRepository.messages.upsertMessage(newMessageRow, oldMessageRow);

		if (newMessageRow.poll?.results) newMessageRow.poll.results.answer_counts = null;
		await this.deps.dispatchService.dispatchMessageUpdate({
			channel,
			message: new Message(newMessageRow),
		});
		// TODO(speykious): send poll results embed

		const row = expiryRow ? expiryRow : await this.deps.pollExpiryRepository.fetchById(message.id);
		if (row) {
			await this.deps.pollExpiryRepository.deleteRecords({
				expiry_bucket: row.expiry_bucket,
				expires_at: row.expires_at,
				message_id: message.id,
			});
		}
	}

	async removeAllVotes(channelId: ChannelID, messageId: MessageID) {
		await this.deps.channelRepository.messageInteractions.removeAllVotes(channelId, messageId);
	}

	async removeAllVotesBulk(channelId: ChannelID, messageIds: Array<MessageID>) {
		await this.deps.channelRepository.messageInteractions.removeAllVotesBulk(channelId, messageIds);
	}

	async vote({
		userId,
		channelId,
		messageId,
		answerIds,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		answerIds: Array<number>;
	}): Promise<void> {
		const authChannel = await this.deps.channelAuthService.getChannelAuthenticated({
			userId,
			channelId,
		});
		const {channel} = authChannel;
		const message = await this.deps.channelRepository.messages.getMessage(channel.id, messageId);
		if (!message) throw new UnknownMessageError();

		const oldMessageRow = message.toRow();
		const newMessageRow = message.toRow();
		const poll = newMessageRow.poll;
		if (!poll) throw new CannotVoteOnNonPollError();

		if (!poll.allow_multiselect && answerIds.length > 1) throw new CannotSelectMultipleAnswersError();

		if (!poll.results) {
			poll.results = {
				is_finalized: false,
				answer_counts: null,
			};
		}
		if (!poll.results.answer_counts) {
			poll.results.answer_counts = (poll.answers ?? []).map((answer) => ({
				id: answer.answer_id,
				count: 0,
			}));
		}

		const existingAnswers = await this.deps.channelRepository.messageInteractions.getVoteAnswers(
			channelId,
			messageId,
			userId,
		);
		const existingAnswerIds = existingAnswers.map((answer) => answer.id);

		if (answerIds.length === 0) {
			for (const answerId of existingAnswerIds) {
				await this.deps.messageReactionService.removeReaction({
					authChannel,
					messageId,
					actorId: userId,
					targetId: userId,
					emoji: `${answerId}:${answerId}`,
					reactionType: 2,
				});
			}
		} else {
			for (const answerId of answerIds) {
				if (existingAnswerIds.includes(answerId)) continue;
				await this.deps.messageReactionService.addReaction({
					authChannel,
					messageId,
					userId,
					emoji: `${answerId}:${answerId}`,
					reactionType: 2,
				});
			}
			for (const existingAnswerId of existingAnswerIds) {
				if (answerIds.includes(existingAnswerId)) continue;
				await this.deps.messageReactionService.removeReaction({
					authChannel,
					messageId,
					actorId: userId,
					targetId: userId,
					emoji: `${existingAnswerId}:${existingAnswerId}`,
					reactionType: 2,
				});
			}
		}

		for (const answerCount of poll.results.answer_counts) {
			const currentlyExists = existingAnswerIds.includes(answerCount.id ?? 0);
			const willExist = answerIds.includes(answerCount.id ?? 0);
			if (!answerCount.count) answerCount.count = 0;
			if (currentlyExists && !willExist) answerCount.count--;
			if (!currentlyExists && willExist) answerCount.count++;
		}

		await this.deps.channelRepository.messages.upsertMessage(newMessageRow, oldMessageRow);
	}
}
