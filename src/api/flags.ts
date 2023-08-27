

import user from '../user';
import flags from '../flags';
import { FlagHistoryObject, FlagNotesObject, Note, FlagObject } from '../types/flag';

interface Caller {
    uid: string | number ;
}

interface Data {
    uid: string | number;
    type: string;
    id: string | number;
    reason: string;
    [key: string]: any;
    datetime? : Date;
    flagId?: string | number;
}

export async function create(caller: Caller, data: Data) {
    const required = ['type', 'id', 'reason'];
    if (!required.every(prop => !!data[prop])) {
        throw new Error('[[error:invalid-data]]');
    }

    const { type, id, reason } = data;

    await flags.validate({
        uid: caller.uid,
        type: type,
        id: id,
    });
    const flagObj: FlagObject = await flags.create(type, id, caller.uid, reason) as FlagObject;
    try {
        await flags.notify(flagObj, caller.uid);
    } catch (err) {
        // ignore
    }
    return flagObj;
}

export async function update(caller: Caller, data: Data) {
    const allowed: boolean = await user.isPrivileged(caller.uid) as boolean;
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }

    const { flagId } = data;
    delete data.flagId;

    await flags.update(flagId, caller.uid, data);
    return await flags.getHistory(flagId) as History;
}

export async function appendNote(caller: Caller, data: Data) {
    const allowed: boolean = await user.isPrivileged(caller.uid) as boolean;
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }
    if (data.datetime && data.flagId) {
        try {
            const note: Note = await flags.getNote(data.flagId, data.datetime) as Note;
            if (note.uid !== caller.uid) {
                throw new Error('[[error:no-privileges]]');
            }
        } catch (e) {
            // Okay if not does not exist in database
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (e.message !== '[[error:invalid-data]]') {
                throw e;
            }
        }
    }
    await flags.appendNote(data.flagId, caller.uid, data.note, data.datetime);
    const [notes, history]: [FlagNotesObject, FlagHistoryObject] = await Promise.all([
        flags.getNotes(data.flagId),
        flags.getHistory(data.flagId),
    ]) as [FlagNotesObject, FlagHistoryObject];
    return { notes: notes, history: history };
}

export async function deleteNote(caller: Caller, data: Data) {
    const note: Note = await flags.getNote(data.flagId, data.datetime) as Note;
    if (note.uid !== caller.uid) {
        throw new Error('[[error:no-privileges]]');
    }

    await flags.deleteNote(data.flagId, data.datetime);
    await flags.appendHistory(data.flagId, caller.uid, {
        notes: '[[flags:note-deleted]]',
        datetime: Date.now(),
    });

    const [notes, history]: [FlagNotesObject, FlagHistoryObject] = await Promise.all([
        flags.getNotes(data.flagId),
        flags.getHistory(data.flagId),
    ]) as [FlagNotesObject, FlagHistoryObject];
    return { notes, history };
}

