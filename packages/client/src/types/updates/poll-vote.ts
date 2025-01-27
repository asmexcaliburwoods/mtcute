import { MtUnsupportedError, User, UsersIndex } from '../'
import { TelegramClient } from '../../client'
import { tl } from '@mtcute/tl'
import { makeInspectable } from '../utils'

/**
 * Some user has voted in a public poll.
 *
 * Bots only receive new votes in polls
 * that were sent by this bot.
 */
export class PollVoteUpdate {
    readonly client: TelegramClient
    readonly raw: tl.RawUpdateMessagePollVote

    readonly _users: UsersIndex

    constructor(
        client: TelegramClient,
        raw: tl.RawUpdateMessagePollVote,
        users: UsersIndex
    ) {
        this.client = client
        this.raw = raw
        this._users = users
    }

    /**
     * Unique poll ID
     */
    get pollId(): tl.Long {
        return this.raw.pollId
    }

    private _user?: User
    /**
     * User who has voted
     */
    get user(): User {
        if (!this._user) {
            this._user = new User(this.client, this._users[this.raw.userId])
        }

        return this._user
    }

    /**
     * Answers that the user has chosen.
     *
     * Note that due to incredible Telegram APIs, you
     * have to have the poll cached to be able to properly
     * tell which answers were chosen, since in the API
     * there are just arbitrary `Buffer`s, which are
     * defined by the client.
     *
     * However, most of the major implementations
     * (tested with TDLib and Bot API, official apps
     * for Android, Desktop, iOS/macOS) and MTCute
     * (by default) create `option` as a one-byte `Buffer`,
     * incrementing from `48` (ASCII `0`) up to `57` (ASCII `9`),
     * and ASCII representation would define index in the array.
     * Meaning, if `chosen[0][0] === 48` or `chosen[0].toString() === '0'`,
     * then the first answer (indexed with `0`) was chosen. To get the index,
     * you simply subtract `48` from the first byte.
     *
     * This might break at any time, but seems to be consistent for now.
     * To get chosen answer indexes derived as before, use {@link chosenIndexesAuto}.
     */
    get chosen(): ReadonlyArray<Buffer> {
        return this.raw.options
    }

    /**
     * Indexes of the chosen answers, derived based on observations
     * described in {@link chosen}.
     * This might break at any time, but seems to be consistent for now.
     *
     * If something does not add up, {@link MtUnsupportedError} is thrown
     */
    get chosenIndexesAuto(): ReadonlyArray<number> {
        return this.raw.options.map((buf) => {
            if (buf.length > 1)
                throw new MtUnsupportedError('option had >1 byte')
            if (buf[0] < 48 || buf[0] > 57)
                throw new MtUnsupportedError(
                    'option had first byte out of 0-9 range'
                )

            return buf[0] - 48
        })
    }
}

makeInspectable(PollVoteUpdate)
