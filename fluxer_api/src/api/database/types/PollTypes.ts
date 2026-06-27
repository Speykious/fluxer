type Nullish<T> = T | null;

export interface MessagePollEmoji {
    id: Nullish<string>;
    name: Nullish<string>;
}
export interface MessagePollMedia {
    emoji: Nullish<MessagePollEmoji>;
    text: Nullish<string>;
}

export interface MessagePollAnswer {
    answer_id: Nullish<number>;
    poll_media: Nullish<MessagePollMedia>;
}

export interface MessagePollAnswerCount {
    id: Nullish<number>;
    count: Nullish<number>;
    me_voted: Nullish<boolean>;
}

export interface MessagePollResults {
    answer_counts: Nullish<Array<MessagePollAnswerCount>>;
    is_finalized: Nullish<boolean>;
}

export interface MessagePoll {
    question: Nullish<MessagePollMedia>;
    answers: Nullish<Array<MessagePollAnswer>>;
    expiry: Nullish<string>;
    allow_multiselect: Nullish<boolean>;
    layout_type: Nullish<number>;
    results: Nullish<MessagePollResults>;
}

export interface MessagePollAnswerCountDb {
    id: Nullish<number>;
    count: Nullish<number>;
}

export interface MessagePollResultsDb {
    answer_counts: Nullish<Array<MessagePollAnswerCountDb>>;
    is_finalized: Nullish<boolean>;
}

export interface MessagePollDb {
    question: Nullish<MessagePollMedia>;
    answers: Nullish<Array<MessagePollAnswer>>;
    expiry: Nullish<string>;
    allow_multiselect: Nullish<boolean>;
    layout_type: Nullish<number>;
    results: Nullish<MessagePollResultsDb>;
}
