// SPDX-License-Identifier: AGPL-3.0-or-later

import {CannotVoteOnFinalizedPollError} from '@fluxer/errors/src/domains/channel/CannotVoteOnFinalizedPollError';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createChannelID, createMessageID, createUserID} from '../../../BrandedTypes';
import {EMPTY_USER_ROW} from '../../../database/types/UserTypes';
import type {Message} from '../../../models/Message';
import {User} from '../../../models/User';
import {MessagePollService} from './MessagePollService';

const channelId = createChannelID(100n);
const messageId = createMessageID(200n);
const voterId = createUserID(300n);

function createUser(id = voterId, username = 'voter'): User {
	return new User({
		...EMPTY_USER_ROW,
		user_id: id,
		username,
		discriminator: 1234,
		bot: true,
		version: 1,
	});
}

function createPollMessage(overrides?: {
	expiry?: string | null;
	allowMultiselect?: boolean;
	anonymousVoting?: boolean;
}): Message {
	const createPoll = () => ({
		question: {text: 'Choose', emoji: null},
		answers: [
			{answer_id: 1, poll_media: {text: 'One', emoji: null}},
			{answer_id: 2, poll_media: {text: 'Two', emoji: null}},
		],
		expiry: overrides?.expiry ?? new Date(Date.now() + 60_000).toISOString(),
		anonymous_voting: overrides?.anonymousVoting ?? false,
		allow_multiselect: overrides?.allowMultiselect ?? true,
		layout_type: 1,
		results: {
			is_finalized: false,
			answer_counts: [
				{id: 1, count: 0},
				{id: 2, count: 0},
			],
		},
	});
	return {
		id: messageId,
		channelId,
		authorId: voterId,
		poll: createPoll(),
		toRow: () => ({poll: createPoll()}),
	} as unknown as Message;
}

function createService(message: Message) {
	const getMessage = vi.fn().mockResolvedValue(message);
	const upsertMessage = vi.fn().mockResolvedValue(undefined);
	const getVoteAnswers = vi.fn().mockResolvedValue([]);
	const getVotesForAnswer = vi.fn();
	const addReaction = vi.fn().mockResolvedValue(undefined);
	const removeReaction = vi.fn().mockResolvedValue(undefined);
	const listUsers = vi.fn().mockResolvedValue([]);
	const hasPermission = vi.fn().mockResolvedValue(true);
	const channel = {id: channelId};
	const service = new MessagePollService({
		channelAuthService: {
			getChannelAuthenticated: vi.fn().mockResolvedValue({channel, guild: null, hasPermission}),
		},
		channelRepository: {
			messages: {getMessage, upsertMessage},
			messageInteractions: {getVoteAnswers, getVotesForAnswer},
		},
		userRepository: {listUsers},
		dispatchService: {},
		pollExpiryRepository: {},
		messageReactionService: {addReaction, removeReaction},
		messageSendService: {},
	} as never);
	return {
		service,
		mocks: {
			getMessage,
			upsertMessage,
			getVoteAnswers,
			getVotesForAnswer,
			addReaction,
			removeReaction,
			listUsers,
			hasPermission,
		},
	};
}

describe('MessagePollService', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('rejects a vote after the poll expiry even before the finalizer runs', async () => {
		const message = createPollMessage({expiry: new Date(Date.now() - 60_000).toISOString()});
		const {service, mocks} = createService(message);

		await expect(service.vote({user: createUser(), channelId, messageId, answerIds: [1]})).rejects.toBeInstanceOf(
			CannotVoteOnFinalizedPollError,
		);
		expect(mocks.getVoteAnswers).not.toHaveBeenCalled();
		expect(mocks.addReaction).not.toHaveBeenCalled();
		expect(mocks.upsertMessage).not.toHaveBeenCalled();
	});

	it('normalizes duplicate internal answer IDs before mutating vote state', async () => {
		const {service, mocks} = createService(createPollMessage());

		await service.vote({user: createUser(), channelId, messageId, answerIds: [1, 1]});

		expect(mocks.addReaction).toHaveBeenCalledTimes(1);
		expect(mocks.addReaction).toHaveBeenCalledWith(expect.objectContaining({emoji: '1:1'}));
		const newMessageRow = mocks.upsertMessage.mock.calls[0][0];
		expect(newMessageRow.poll.results.answer_counts).toContainEqual({id: 1, count: 1});
	});

	it('preserves voter-page order when the user repository returns a different order', async () => {
		const firstUser = createUser(createUserID(401n), 'first');
		const secondUser = createUser(createUserID(402n), 'second');
		const {service, mocks} = createService(createPollMessage());
		mocks.getVotesForAnswer.mockResolvedValue({
			userIds: [secondUser.id, firstUser.id],
			hasMore: true,
			nextAfter: firstUser.id.toString(),
		});
		mocks.listUsers.mockResolvedValue([firstUser, secondUser]);

		const response = await service.getVotesForAnswer({
			userId: voterId,
			channelId,
			messageId,
			answerId: 1,
		});

		expect(response.users.map((user) => user.id)).toEqual([secondUser.id.toString(), firstUser.id.toString()]);
		expect(response.has_more).toBe(true);
		expect(response.next_after).toBe(firstUser.id.toString());
	});
});
