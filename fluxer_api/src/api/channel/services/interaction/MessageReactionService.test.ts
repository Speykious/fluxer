// SPDX-License-Identifier: AGPL-3.0-or-later

import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {MaxPollVotesPerAnswerError} from '@fluxer/errors/src/domains/channel/MaxPollVotesPerAnswerError';
import {describe, expect, it, vi} from 'vitest';
import {createChannelID, createMessageID, createUserID} from '../../../BrandedTypes';
import {MessageReactionService} from './MessageReactionService';

describe('MessageReactionService poll vote limits', () => {
	it('returns the poll-specific error before persisting a vote at the configured limit', async () => {
		const channelId = createChannelID(10n);
		const messageId = createMessageID(20n);
		const userId = createUserID(30n);
		const addVote = vi.fn();
		const service = new MessageReactionService(
			{} as never,
			{
				messages: {
					getMessage: vi.fn().mockResolvedValue({
						poll: {
							answers: [{answer_id: 1}],
							results: {answer_counts: [{id: 1, count: 1}]},
						},
					}),
				},
				messageInteractions: {addVote},
			} as never,
			{findUnique: vi.fn().mockResolvedValue(null)} as never,
			{} as never,
			{
				getConfigSnapshot: () => ({
					traitDefinitions: [],
					rules: [{id: 'default', limits: {max_poll_votes_per_answer: 1}}],
				}),
			} as never,
		);
		const authChannel = {
			channel: {id: channelId, type: ChannelTypes.DM},
			guild: null,
			member: null,
			hasPermission: vi.fn().mockResolvedValue(true),
			checkPermission: vi.fn().mockResolvedValue(undefined),
		};

		await expect(
			service.addReaction({authChannel: authChannel as never, messageId, emoji: '1:1', userId, reactionType: 2}),
		).rejects.toBeInstanceOf(MaxPollVotesPerAnswerError);
		expect(addVote).not.toHaveBeenCalled();
	});
});
