import { TelegramClient } from '../../client'
import { User } from '../../types'
import { assertTypeIs } from '../../utils/type-assertion'

/**
 * Recover your password with a recovery code and log in.
 *
 * @param recoveryCode  The recovery code sent via email
 * @returns  The authorized user
 * @throws BadRequestError  In case the code is invalid
 * @internal
 */
export async function recoverPassword(
    this: TelegramClient,
    recoveryCode: string
): Promise<User> {
    const res = await this.call({
        _: 'auth.recoverPassword',
        code: recoveryCode,
    })

    assertTypeIs(
        'recoverPassword (@ auth.recoverPassword)',
        res,
        'auth.authorization'
    )
    assertTypeIs(
        'recoverPassword (@ auth.recoverPassword -> user)',
        res.user,
        'user'
    )

    await this.storage.setSelf({
        userId: res.user.id,
        isBot: false,
    })
    await this._saveStorage()

    return new User(this, res.user)
}
