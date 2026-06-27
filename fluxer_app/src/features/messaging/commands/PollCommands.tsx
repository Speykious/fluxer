// SPDX-License-Identifier: AGPL-3.0-or-later

import {FeatureTemporarilyDisabledModal} from '@app/features/app/components/alerts/FeatureTemporarilyDisabledModal';
import {ConfirmModal} from '@app/features/app/components/dialogs/ConfirmModal';
import {Endpoints} from '@app/features/app/constants/Endpoints';
import {ERROR_DESCRIPTOR} from '@app/features/channel/components/channel_search_results/ChannelSearchResultsShared';
import {END_POLL_NOW_DESCRIPTOR, OKAY_DESCRIPTOR} from '@app/features/i18n/utils/CommonMessageDescriptors';
import type {Message as MessageModel} from '@app/features/messaging/models/MessagingMessage';
import {http} from '@app/features/platform/transport/RestTransport';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {failureCode} from '@app/features/platform/utils/ResponseInspection';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const logger = new Logger('PollCommands');

const THIS_WILL_CLOSE_THE_POLL_DESCRIPTOR = msg({
	message: 'This will close the poll now and show the results.',
	comment: 'Description of the action of ending a poll in a confirmation modal.',
});

interface ShowEndPollConfirmationOptions {
	message: MessageModel;
	onEndPoll?: () => void;
}

export function showEndPollConfirmation(i18n: I18n, {message, onEndPoll}: ShowEndPollConfirmationOptions): void {
	ModalCommands.push(
		modal(() => (
			<ConfirmModal
				title={i18n._(END_POLL_NOW_DESCRIPTOR)}
				description={i18n._(THIS_WILL_CLOSE_THE_POLL_DESCRIPTOR)}
				message={message}
				primaryText={i18n._(OKAY_DESCRIPTOR)}
				primaryVariant="primary"
				onPrimary={async () => {
					endPoll(i18n, message.channelId, message.id);
					onEndPoll?.();
				}}
				data-flx="messaging.message-commands.show-end-poll-confirmation.confirm-modal"
			/>
		)),
	);
}

function onHttpError(i18n: I18n, error: any) {
	const errorCode = failureCode(error);
	if (error.status === 403) {
		if (errorCode === APIErrorCodes.FEATURE_TEMPORARILY_DISABLED) {
			logger.debug('Feature temporarily disabled, not retrying');
			ModalCommands.push(
				modal(() => (
					<FeatureTemporarilyDisabledModal data-flx="messaging.reaction-commands.check-reaction-response.feature-temporarily-disabled-modal" />
				)),
			);
		}
		if (errorCode === APIErrorCodes.CANNOT_EDIT_OTHER_USER_MESSAGE) {
			logger.debug('Tried to end the poll of another user, somehow');
			ToastCommands.createToast({
				type: 'info',
				children: i18n._(ERROR_DESCRIPTOR),
			});
		}
	}
}

export function endPoll(i18n: I18n, channelId: string, messageId: string): void {
	logger.debug(`Ending poll from message ${messageId} in channel ${channelId}`);
	http.post(Endpoints.CHANNEL_POLL_EXPIRE(channelId, messageId)).catch((error) => onHttpError(i18n, error));
}

export function addVote(i18n: I18n, channelId: string, messageId: string, answerIds: Array<number>): void {
	logger.debug(`Adding vote ${answerIds} to poll from message ${messageId} in channel ${channelId}`);
	http
		.put(Endpoints.CHANNEL_POLL_ANSWERS(channelId, messageId, '@me'), {
			body: {
				answerIds: answerIds.map((id) => String(id)),
			},
		})
		.catch((error) => onHttpError(i18n, error));
}

export function removeVote(i18n: I18n, channelId: string, messageId: string): void {
	logger.debug(`Removing vote on poll from message ${messageId} in channel ${channelId}`);
	http
		.put(Endpoints.CHANNEL_POLL_ANSWERS(channelId, messageId, '@me'), {
			body: {
				answerIds: [],
			},
		})
		.catch((error) => onHttpError(i18n, error));
}
