"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston = __importStar(require("winston"));
const user = __importStar(require("../user"));
const notifications = __importStar(require("../notifications"));
const sockets = __importStar(require("../socket.io"));
const plugins = __importStar(require("../plugins"));
const meta = __importStar(require("../meta"));
function default_1(Messaging) {
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    Messaging.notifyQueue = {}; // Only used to notify a user of a new chat message, see Messaging.notifyUser
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    Messaging.notifyUsersInRoom = (fromUid, roomId, messageObj, uids) => __awaiter(this, void 0, void 0, function* () {
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        uids = (yield Messaging.getUidsInRoom(roomId, 0, -1));
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        uids = (yield user.blocks.filterUids(fromUid, uids));
        let data = {
            roomId: roomId,
            fromUid: fromUid,
            message: messageObj,
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            uids: uids,
            self: 0,
        };
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        data = (yield plugins.hooks.fire('filter:messaging.notify', data));
        if (!data || !data.uids || !data.uids.length) {
            return;
        }
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        uids = data.uids;
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        uids.forEach((uid) => {
            data.self = parseInt(uid, 10) === parseInt(fromUid, 10) ? 1 : 0;
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            Messaging.pushUnreadCount(uid);
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            sockets.in(`uid_${uid}`).emit('event:chats.receive', data);
        });
        if (messageObj.system) {
            return;
        }
        // Delayed notifications
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        let queueObj = Messaging.notifyQueue[`${fromUid}:${roomId}`];
        if (queueObj) {
            queueObj.message.content += `\n${messageObj.content}`;
            clearTimeout(queueObj.timeout);
        }
        else {
            queueObj = {
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
                message: messageObj,
                timeout: undefined,
            };
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            Messaging.notifyQueue[`${fromUid}:${roomId}`] = queueObj;
        }
        // clearTimeout(queueObj.timeout);
        function sendNotifications(fromuid, uids, roomId, messageObj) {
            return __awaiter(this, void 0, void 0, function* () {
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
                const isOnline = (yield user.isOnline(uids));
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
                uids = uids.filter((uid, index) => !isOnline[index] &&
                    parseInt(fromuid.toString(), 10) !== parseInt(uid.toString(), 10));
                if (!uids.length) {
                    return;
                }
                const { displayname } = messageObj.fromUser;
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
                const isGroupChat = yield Messaging.isGroupChat(roomId);
                const notification = yield notifications.create({
                    type: isGroupChat ? 'new-group-chat' : 'new-chat',
                    subject: `[[email:notif.chat.subject, ${displayname}]]`,
                    bodyShort: `[[notifications:new_message_from, ${displayname}]]`,
                    bodyLong: messageObj.content,
                    nid: `chat_${fromuid}_${roomId}`,
                    from: fromuid,
                    path: `/chats/${messageObj.roomid}`,
                });
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
                delete Messaging.notifyQueue[`${fromuid}:${roomId}`];
                yield notifications.push(notification, uids);
            });
        }
        queueObj.timeout = setTimeout(() => {
            sendNotifications(fromUid, uids, roomId, queueObj.message)
                .catch((err) => {
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                @typescript-eslint/no-unsafe-call */
                winston.error(`[messaging/notifications] Unable to send notification\n${err.stack.toString()}`);
            });
        }, 
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        meta.config.notificationSendDelay * 1000);
    });
}
exports.default = default_1;
