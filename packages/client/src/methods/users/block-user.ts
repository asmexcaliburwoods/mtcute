import { InputPeerLike } from '../../types'
import { TelegramClient } from '../../client'
import { normalizeToInputPeer } from '../../utils/peer-utils'

/**
 * Block a user
 *
 * @param id  User ID, username or phone number
 * @internal
 */
export async function blockUser(
    this: TelegramClient,
    id: InputPeerLike
): Promise<void> {
    await this.call({
        _: 'contacts.block',
        id: normalizeToInputPeer(await this.resolvePeer(id)),
    })
}
