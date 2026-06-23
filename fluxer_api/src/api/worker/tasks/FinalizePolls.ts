// SPDX-License-Identifier: AGPL-3.0-or-later

import {PollMessageExpiryRepository, getExpiryBucket} from '@app/api/channel/repositories/PollMessageExpiryRepository';
import type {WorkerTaskHandler} from '@pkgs/worker/src/contracts/WorkerTask';
import {Logger} from '../../Logger';
import {getWorkerDependencies} from '../WorkerContext';
import {Message} from '@app/api/models/Message';

const BUCKET_LOOKBACK_DAYS = 3;
const FETCH_LIMIT = 200;

export async function processFinalizedPolls(now = new Date()): Promise<void> {
	const {channelRepository, channelService} = getWorkerDependencies();
	const messageRepository = channelRepository.messages;
	const messageDispatchService = channelService.messages.dispatch;

	const repo = new PollMessageExpiryRepository();
	let totalQueued = 0;
	let totalDeletedRows = 0;
	for (let offset = 0; offset <= BUCKET_LOOKBACK_DAYS; offset++) {
		const bucketDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
		const bucket = getExpiryBucket(bucketDate);
		while (true) {
			const expired = await repo.fetchExpiredByBucket(bucket, now, FETCH_LIMIT);
			if (expired.length === 0) break;
			for (const row of expired) {
				const metadata = await repo.fetchById(row.message_id);
				if (!metadata) {
					await repo.deleteRecords({
						expiry_bucket: row.expiry_bucket,
						expires_at: row.expires_at,
						message_id: row.message_id,
					});
					totalDeletedRows++;
					continue;
				}
				if (metadata.expires_at > row.expires_at) {
					await repo.deleteRecords({
						expiry_bucket: row.expiry_bucket,
						expires_at: row.expires_at,
						message_id: row.message_id,
					});
					totalDeletedRows++;
					continue;
				}

				const message = await messageRepository.getMessage(row.channel_id, row.message_id);
				if (message) {
					const oldMessageRow = message.toRow();
					const newMessageRow = message.toRow();
					const poll = newMessageRow.poll;
					if (poll) {
						// poll.question = {
						// 	emoji: null,
						// 	text: "THIS POLL WAS FINALIZED AND YOU'LL NEVER KNOW WHAT THE QUESTION WAS",
						// };

						if (poll.results) {
							poll.results.is_finalized = true;
							poll.results.answer_counts =
								poll.results.answer_counts?.map((answerCount) => {
									if (answerCount.count) answerCount.count += 4;
									return answerCount;
								}) ?? null;
						} else {
							poll.results = {
								is_finalized: true,
								answer_counts: (poll.answers ?? []).map((answer) => ({
									id: answer.answer_id,
									count: 99,
									me_voted: false,
								})),
							};
						}
					}

					await messageRepository.upsertMessage(newMessageRow, oldMessageRow);

					const channel = await channelRepository.channelData.findUnique(row.channel_id);
					if (channel) {
						await messageDispatchService.dispatchMessageUpdate({
							channel,
							message: new Message(newMessageRow),
						});
					}
				}

				await repo.deleteRecords({
					expiry_bucket: row.expiry_bucket,
					expires_at: row.expires_at,
					message_id: row.message_id,
				});
				totalQueued++;
				totalDeletedRows++;
			}
		}
	}
	Logger.info(
		{
			queuedForFinalization: totalQueued,
			expiryRowsRemoved: totalDeletedRows,
			lookbackDays: BUCKET_LOOKBACK_DAYS,
		},
		'Processed poll message expiry buckets',
	);
}

const finalizePolls: WorkerTaskHandler = async () => {
	await processFinalizedPolls();
};

export default finalizePolls;
