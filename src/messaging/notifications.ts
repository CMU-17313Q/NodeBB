import * as winston from 'winston';
import * as user from '../user';
import * as notifications from '../notifications';
import * as sockets from '../socket.io';
import * as plugins from '../plugins';
import * as meta from '../meta';

interface MessageObject {
    content: string;
    fromUser: {
        displayname: string;
    };
    roomid: number;
    system: boolean;
}

interface QueueObject {
    message: MessageObject;
    timeout: NodeJS.Timeout;
}

export default function (Messaging: any): void {
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    Messaging.notifyQueue = {}; // Only used to notify a user of a new chat message, see Messaging.notifyUser

    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    Messaging.notifyUsersInRoom = async (
        fromUid: string,
        roomId: number,
        messageObj: MessageObject,
        uids: string[]
    ):Promise<void> => {
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        uids = (await Messaging.getUidsInRoom(roomId, 0, -1)) as string[];
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        uids = (await user.blocks.filterUids(fromUid, uids)) as string[];
        let data = {
            roomId: roomId,
            fromUid: fromUid,
            message: messageObj,
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            uids: uids,
            self: 0,
        };
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        data = await plugins.hooks.fire('filter:messaging.notify', data) as {
            roomId: number;
            fromUid: string;
            message: MessageObject;
            uids: string[];
            self: number;
          };
        if (!data || !data.uids || !data.uids.length) {
            return;
        }
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        uids = data.uids;
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        uids.forEach((uid) => {
            data.self = parseInt(uid, 10) === parseInt(fromUid, 10) ? 1 : 0;
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            Messaging.pushUnreadCount(uid) as void;
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            sockets.in(`uid_${uid}`).emit('event:chats.receive', data);
        });
        if (messageObj.system) {
            return;
        }
        // Delayed notifications
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        let queueObj: QueueObject = Messaging.notifyQueue[`${fromUid}:${roomId}`] as QueueObject;
        if (queueObj) {
            queueObj.message.content += `\n${messageObj.content}`;
            clearTimeout(queueObj.timeout);
        } else {
            queueObj = {
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
                message: messageObj,
                timeout: undefined,
            };
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            Messaging.notifyQueue[`${fromUid}:${roomId}`] = queueObj;
        }
        // clearTimeout(queueObj.timeout);
        async function sendNotifications(
            fromuid: string,
            uids: string[],
            roomId: number,
            messageObj: MessageObject
        ): Promise<void> {
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            const isOnline = (await user.isOnline(uids)) as boolean[];
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            uids = uids.filter((uid, index) => !isOnline[index] &&
            parseInt(fromuid.toString(), 10) !== parseInt(uid.toString(), 10));
            if (!uids.length) {
                return;
            }
            const { displayname } = messageObj.fromUser;
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            const isGroupChat: boolean = await Messaging.isGroupChat(roomId) as boolean;
            const notification: Notification = await notifications.create({
                type: isGroupChat ? 'new-group-chat' : 'new-chat',
                subject: `[[email:notif.chat.subject, ${displayname}]]`,
                bodyShort: `[[notifications:new_message_from, ${displayname}]]`,
                bodyLong: messageObj.content,
                nid: `chat_${fromuid}_${roomId}`,
                from: fromuid,
                path: `/chats/${messageObj.roomid}`,
            }) as Notification;
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            delete Messaging.notifyQueue[`${fromuid}:${roomId}`];
            await notifications.push(notification, uids);
        }
        queueObj.timeout = setTimeout(() => {
            sendNotifications(fromUid, uids, roomId, queueObj.message)
                .catch((err) => {
                    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                    @typescript-eslint/no-unsafe-call */
                    winston.error(`[messaging/notifications] Unable to send notification\n${(err as Error).stack.toString()}`);
                });
        },
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        meta.config.notificationSendDelay * 1000);
    };
}
