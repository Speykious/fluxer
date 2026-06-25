// SPDX-License-Identifier: AGPL-3.0-or-later

import {Message} from '@app/api/models/Message';
import type {PollMessageExpiryRow} from '@app/api/Tables';
import {UnknownMessageError} from '@fluxer/errors/src/domains/channel/UnknownMessageError';
import type {ChannelID, MessageID, UserID} from '../../../BrandedTypes';
import type {IChannelRepositoryAggregate} from '../../repositories/IChannelRepositoryAggregate';
import type {PollMessageExpiryRepository} from '../../repositories/PollMessageExpiryRepository';
import type {MessageChannelAuthService} from './MessageChannelAuthService';
import type {MessageDispatchService} from './MessageDispatchService';
import type {Channel} from '@app/api/models/Channel';
import {CannotEditOtherUserMessageError} from '@fluxer/errors/src/domains/channel/CannotEditOtherUserMessageError';

interface MessagePollServiceDeps {
	channelAuthService: MessageChannelAuthService;
	channelRepository: IChannelRepositoryAggregate;
	dispatchService: MessageDispatchService;
	pollExpiryRepository: PollMessageExpiryRepository;
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
		console.log('TRYING TO END POLL IN MESSAGE', message?.id, '...');
		if (message?.authorId !== userId) {
			console.log('CANNOT EDIT OTHER USER MESSAGE');
			throw new CannotEditOtherUserMessageError();
		}
		console.log('CONTINUING TO END POLL...');

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
						me_voted: false, // TODO: remove me_voted from db
					})),
				};
			}
		}

		await this.deps.channelRepository.messages.upsertMessage(newMessageRow, oldMessageRow);
		await this.deps.dispatchService.dispatchMessageUpdate({
			channel,
			message: new Message(newMessageRow),
		});
		// TODO: send poll results embed

		const row = expiryRow ? expiryRow : await this.deps.pollExpiryRepository.fetchById(message.id);
		if (row) {
			await this.deps.pollExpiryRepository.deleteRecords({
				expiry_bucket: row.expiry_bucket,
				expires_at: row.expires_at,
				message_id: message.id,
			});
		}
	}
}
