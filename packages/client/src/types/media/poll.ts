import { makeInspectable } from '../utils'
import { tl } from '@mtcute/tl'
import { TelegramClient } from '../../client'
import { MessageEntity } from '../messages'
import bigInt from 'big-integer'
import { UsersIndex } from '../peers'

export namespace Poll {
    export interface PollAnswer {
        /**
         * Answer text
         */
        text: string

        /**
         * Answer data, to be passed to
         * {@link TelegramClient.sendVote}
         */
        data: Buffer

        /**
         * Number of people who has chosen this result.
         * If not available (i.e. not voted yet), defaults to `0`
         */
        voters: number

        /**
         * Whether this answer was chosen by the current user
         */
        chosen: boolean

        /**
         * Whether this answer is correct (for quizzes).
         * Not available before choosing an answer, and defaults to `false`
         */
        correct: boolean
    }
}

export class Poll {
    readonly type = 'poll' as const

    readonly client: TelegramClient
    readonly raw: tl.TypePoll
    readonly results?: tl.TypePollResults

    readonly _users: UsersIndex

    constructor(
        client: TelegramClient,
        raw: tl.TypePoll,
        users: UsersIndex,
        results?: tl.TypePollResults
    ) {
        this.client = client
        this.raw = raw
        this._users = users
        this.results = results
    }

    /**
     * Unique identifier of the poll
     */
    get id(): tl.Long {
        return this.raw.id
    }

    /**
     * Poll question
     */
    get question(): string {
        return this.raw.question
    }

    private _answers?: Poll.PollAnswer[]
    /**
     * List of answers in this poll
     */
    get answers(): ReadonlyArray<Poll.PollAnswer> {
        if (!this._answers) {
            const results = this.results?.results

            this._answers = this.raw.answers.map((ans, idx) => {
                if (results) {
                    const res = results[idx]
                    return {
                        text: ans.text,
                        data: ans.option,
                        voters: res.voters,
                        chosen: !!res.chosen,
                        correct: !!res.correct,
                    }
                } else {
                    return {
                        text: ans.text,
                        data: ans.option,
                        voters: 0,
                        chosen: false,
                        correct: false,
                    }
                }
            })
        }

        return this._answers
    }

    /**
     * Total number of voters in this poll, if available
     */
    get voters(): number {
        return this.results?.totalVoters ?? 0
    }

    /**
     * Whether this poll is closed, i.e. does not
     * accept votes anymore
     */
    get isClosed(): boolean {
        return this.raw.closed!
    }

    /**
     * Whether this poll is public, i.e. you
     * list of voters is publicly available
     */
    get isPublic(): boolean {
        return this.raw.publicVoters!
    }

    /**
     * Whether this is a quiz
     */
    get isQuiz(): boolean {
        return this.raw.quiz!
    }

    /**
     * Whether this poll accepts multiple answers
     */
    get isMultiple(): boolean {
        return this.raw.multipleChoice!
    }

    /**
     * Solution for the quiz, only available
     * in case you have already answered
     */
    get solution(): string | null {
        return this.results?.solution ?? null
    }

    private _entities?: MessageEntity[]
    /**
     * Format entities for {@link solution}, only available
     * in case you have already answered
     */
    get solutionEntities(): ReadonlyArray<MessageEntity> | null {
        if (!this.results) return null

        if (!this._entities) {
            this._entities = []
            if (this.results.solutionEntities?.length) {
                for (const ent of this.results.solutionEntities) {
                    const parsed = MessageEntity._parse(ent)
                    if (parsed) this._entities.push(parsed)
                }
            }
        }

        return this._entities
    }

    /**
     * Get the solution text formatted with a given parse mode.
     * Returns `null` if solution is not available
     *
     * @param parseMode  Parse mode to use (`null` for default)
     */
    unparseSolution(parseMode?: string | null): string | null {
        if (!this.solution) return null

        return this.client
            .getParseMode(parseMode)
            .unparse(this.solution, this.solutionEntities!)
    }

    /**
     * Input media TL object generated from this object,
     * to be used inside {@link InputMediaLike} and
     * {@link TelegramClient.sendMedia}
     *
     * A few notes:
     *  - Using this will result in an
     *    independent poll, which will not
     *    be auto-updated with the current.
     *  - If this is a quiz, a normal poll
     *    will be returned since the client does not
     *    know the correct answer.
     *  - This always returns a non-closed poll,
     *    even if the current poll was closed
     */
    get inputMedia(): tl.TypeInputMedia {
        return {
            _: 'inputMediaPoll',
            poll: {
                _: 'poll',
                closed: false,
                id: bigInt.zero,
                publicVoters: this.raw.publicVoters,
                multipleChoice: this.raw.multipleChoice,
                question: this.raw.question,
                answers: this.raw.answers,
                closePeriod: this.raw.closePeriod,
                closeDate: this.raw.closeDate,
            },
        }
    }
}

makeInspectable(Poll, undefined, ['inputMedia'])
