// SPDX-License-Identifier: AGPL-3.0-or-later

import {TextareaButton} from '@app/features/channel/components/textarea/TextareaButton';
import * as ExpressionPickerCommands from '@app/features/emoji/commands/ExpressionPickerCommands';
import type {FlatEmoji} from '@app/features/emoji/types/EmojiTypes';
import {ExpressionPickerPopout} from '@app/features/expressions/components/popouts/ExpressionPickerPopout';
import styles from '@app/features/messaging/components/modals/poll_modal/PollAnswerInput.module.css';
import * as PopoutCommands from '@app/features/ui/commands/PopoutCommands';
import {Input} from '@app/features/ui/components/form/FormInput';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {openPopout} from '@app/features/ui/popover/PopoverPopout';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import {i18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {SmileyIcon, TrashIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useRef} from 'react';
import type {InputProps} from 'react-aria-components';

export const POLL_ANSWER_PLACEHOLDER_DESCRIPTOR = msg({
	message: 'A possible answer',
	comment: 'Placeholder text for each answer input.',
});
export const POLL_SELECT_EMOJI_DESCRIPTOR = msg({
	message: 'Select emoji',
	comment: 'Tooltip text for the emoji selection button on an answer.',
});
export const POLL_DELETE_ANSWER_DESCRIPTOR = msg({
	message: 'Delete Answer',
	comment: 'Tooltip text for the button that deletes an answer from the poll.',
});

interface PollAnswerInputProps {
	emojiValue?: FlatEmoji;
	onEmojiSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void;
	textValue: string;
	onTextChange: (text: string) => void;
	onDelete: () => void;
	showDelete: boolean;
	channelId: string;
	error?: string;
}

export const PollAnswerInput = observer(
	({
		emojiValue,
		onEmojiSelect,
		textValue,
		onTextChange,
		onDelete,
		showDelete,
		channelId,
		error,
		maxLength,
	}: PollAnswerInputProps & InputProps) => {
		const textareaRef = useRef<HTMLInputElement>(null);
		const expressionPickerTriggerRef = useRef<HTMLButtonElement>(null);
		const getExpressionPickerPopoutKey = useCallback(() => `expression-picker-poll-${channelId}`, [channelId]);
		const closeExpressionPicker = useCallback(() => {
			const popoutKey = getExpressionPickerPopoutKey();
			PopoutCommands.close(popoutKey);
			ExpressionPickerCommands.close();
		}, [getExpressionPickerPopoutKey]);
		const openExpressionPicker = useCallback(() => {
			const triggerElement = expressionPickerTriggerRef.current;
			if (!triggerElement) return;
			const popoutKey = getExpressionPickerPopoutKey();
			openPopout(
				triggerElement,
				{
					render: ({onClose}) => (
						<ExpressionPickerPopout
							onEmojiSelect={onEmojiSelect}
							visibleTabs={['emojis']}
							onClose={onClose}
							data-flx="messaging.modals.poll-modal.expression-picker-popout"
						/>
					),
					position: 'bottom-start',
					animationType: 'none',
					offsetMainAxis: 8,
					offsetCrossAxis: -4,
					onClose: closeExpressionPicker,
					onCloseRequest: (_event) => true,
					returnFocusRef: textareaRef,
					disableBackdrop: false,
				},
				popoutKey,
			);
		}, [
			channelId,
			onEmojiSelect,
			getExpressionPickerPopoutKey,
			closeExpressionPicker,
			expressionPickerTriggerRef,
			textareaRef,
		]);

		return (
			<Input
				name="answer"
				type="text"
				ref={textareaRef}
				placeholder={i18n._(POLL_ANSWER_PLACEHOLDER_DESCRIPTOR)}
				value={textValue}
				error={error}
				maxLength={maxLength}
				onChange={(e) => onTextChange(e.target.value)}
				leftElement={
					emojiValue ? (
						<Tooltip text={emojiValue.name} data-flx="messaging.create-poll-modal.input.answer.emoji.tooltip">
							<FocusRing data-flx="messaging.create-poll-modal.input.answer.emoji.focus-ring">
								<button
									type="button"
									className={styles.emojiValueButton}
									ref={expressionPickerTriggerRef}
									onClick={() => openExpressionPicker()}
								>
									<img
										src={emojiValue.url}
										alt={emojiValue.name}
										width="24"
										height="24"
										data-flx="messaging.create-poll-modal.input.answer.emoji.img"
									/>
								</button>
							</FocusRing>
						</Tooltip>
					) : (
						<TextareaButton
							icon={SmileyIcon}
							ref={expressionPickerTriggerRef}
							iconProps={{weight: 'fill', size: 'small'}}
							label={i18n._(POLL_SELECT_EMOJI_DESCRIPTOR)}
							onClick={() => openExpressionPicker()}
							data-flx="messaging.create-poll-modal.input.answer.emoji.button"
						/>
					)
				}
				rightElement={
					showDelete ? (
						<TextareaButton
							icon={TrashIcon}
							iconProps={{weight: 'fill', size: 'small'}}
							compact={true}
							className={styles.deleteAnswerButton}
							label={i18n._(POLL_DELETE_ANSWER_DESCRIPTOR)}
							onClick={() => onDelete()}
							data-flx="messaging.create-poll-modal.input.answer.emoji-button"
						/>
					) : undefined
				}
				data-flx="messaging.create-poll-modal.input.answer"
			/>
		);
	},
);
