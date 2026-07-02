// SPDX-License-Identifier: AGPL-3.0-or-later

import type {MessagePollAnswerCount} from '../database/types/PollTypes';

export class PollAnswerCount {
	readonly id: number | null;
	readonly count: number | null;
	readonly me_voted: boolean | null;

	constructor(answer_count: MessagePollAnswerCount) {
		this.id = answer_count.id ?? null;
		this.count = answer_count.count ?? null;
		this.me_voted = answer_count.me_voted ?? null;
	}

	toMessagePollAnswerCount(): MessagePollAnswerCount {
		return {
			id: this.id,
			count: this.count,
			me_voted: this.me_voted,
		};
	}
}
