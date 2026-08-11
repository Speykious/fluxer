// SPDX-License-Identifier: AGPL-3.0-or-later

import {afterEach, describe, expect, it, vi} from 'vitest';
import {createChannelID, createMessageID, createUserID} from '../../BrandedTypes';
import {setCassandraQueryExecutorForTesting} from '../../database/CassandraQueryExecution';
import {MessageInteractionRepository} from './MessageInteractionRepository';

describe('MessageInteractionRepository.getVotesForAnswer', () => {
	afterEach(() => {
		setCassandraQueryExecutorForTesting(null);
	});

	it('uses the extra fetched row only to signal that another page exists', async () => {
		const userIds = [createUserID(101n), createUserID(102n), createUserID(103n)];
		const executeQuery = vi.fn().mockResolvedValue(userIds.map((userId) => ({user_id: userId})));
		setCassandraQueryExecutorForTesting({executeQuery, executeBatch: vi.fn()});
		const repository = new MessageInteractionRepository({} as never);

		const page = await repository.getVotesForAnswer(createChannelID(1n), createMessageID(2n), 1, 2);

		expect(page.userIds).toEqual(userIds.slice(0, 2));
		expect(page.hasMore).toBe(true);
		expect(page.nextAfter).toBe(userIds[1].toString());
		expect(executeQuery).toHaveBeenCalledTimes(1);
	});
});
