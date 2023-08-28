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
    Messaging.notifyQueue = {}; // Only used to notify a user of a new chat message, see Messaging.notifyUser

    Messaging.notifyUsersInRoom = async (fromUid: number, roomId: number, messageObj: MessageObject): Promise<void> => {
        let uids = await Messaging.getUidsInRoom(roomId, 0, -1);
        uids = await user.blocks.filterUids(fromUid, uids);
    
        let data = {
            roomId: roomId,
            fromUid: fromUid,
            message: messageObj,
            uids: uids,
            self: 0, 
        };
        data = await plugins.hooks.fire('filter:messaging.notify', data);
        if (!data || !data.uids || !data.uids.length) {
            return;
        }
    
        uids = data.uids;
        uids.forEach((uid) => {
            
        });
        if (messageObj.system) {
            return;
        }
        // Delayed notifications
        let queueObj: QueueObject = Messaging.notifyQueue[`${fromUid}:${roomId}`];
        if (queueObj) {
            queueObj.message.content += `\n${messageObj.content}`;
            clearTimeout(queueObj.timeout);
        } else {
            queueObj = {
                message: messageObj,
                timeout: undefined,
            };
            Messaging.notifyQueue[`${fromUid}:${roomId}`] = queueObj;
        }
    
       // clearTimeout(queueObj.timeout);
        queueObj.timeout = setTimeout(async () => {
            try {
                await sendNotifications(fromUid, uids, roomId, queueObj.message);
            } catch (err) {
                winston.error(`[messaging/notifications] Unabled to send notification\n${err.stack}`);
            }
        }, meta.config.notificationSendDelay * 1000);
    };
    
    async function sendNotifications(fromuid: number, uids: number[], roomId: number, messageObj: MessageObject): Promise<void> {
        const isOnline = await user.isOnline(uids);
        uids = uids.filter((uid, index) => !isOnline[index] && parseInt(fromuid.toString(), 10) !== parseInt(uid.toString(), 10));
        if (!uids.length) {
            return;
        }

        const { displayname } = messageObj.fromUser;

        const isGroupChat = await Messaging.isGroupChat(roomId);
        const notification = await notifications.create({
            type: isGroupChat ? 'new-group-chat' : 'new-chat',
            subject: `[[email:notif.chat.subject, ${displayname}]]`,
            bodyShort: `[[notifications:new_message_from, ${displayname}]]`,
            bodyLong: messageObj.content,
            nid: `chat_${fromuid}_${roomId}`,
            from: fromuid,
            path: `/chats/${messageObj.roomid}`,
        });

        delete Messaging.notifyQueue[`${fromuid}:${roomId}`];
        notifications.push(notification, uids);
    }
}
