

import * as path from 'path';
import * as nconf from 'nconf';
import * as winston from 'winston';
import * as crypto from 'crypto';

import * as db from '../database';
import * as posts from '../posts';
import * as file from '../file';
import * as batch from '../batch';

const md5 = (filename: string): string => crypto.createHash('md5').update(filename).digest('hex');
const _getFullPath = (relativePath: string): string => path.resolve(nconf.get('upload_path'), relativePath);
const _validatePath = async (relativePaths: string[] | string): Promise<void> => {
    if (typeof relativePaths === 'string') {
        relativePaths = [relativePaths];
    } else if (!Array.isArray(relativePaths)) {
        throw new Error(`[[error:wrong-parameter-type, relativePaths, ${typeof relativePaths}, array]]`);
    }

    const fullPaths = relativePaths.map(path => _getFullPath(path));
    const exists = await Promise.all(fullPaths.map(async fullPath => file.exists(fullPath)));

    if (!fullPaths.every(fullPath => fullPath.startsWith(nconf.get('upload_path'))) || !exists.every(Boolean)) {
        throw new Error('[[error:invalid-path]]');
    }
};

export default function (User: any): void {
    User.associateUpload = async (uid: number, relativePath: string | string[]) => {
        await _validatePath(relativePath);
        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            // db.sortedSetAdd(`uid:${uid}:uploads`, Date.now(), relativePath)

            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            // db.setObjectField(`upload:${md5(relativePath)}`, 'uid', uid),
        ]);
    };

    User.deleteUpload = async function (callerUid: number, uid: number, uploadNames: string | string[]) {
        if (typeof uploadNames === 'string') {
            uploadNames = [uploadNames];
        } else if (!Array.isArray(uploadNames)) {
            throw new Error(`[[error:wrong-parameter-type, uploadNames, ${typeof uploadNames}, array]]`);
        }

        await _validatePath(uploadNames);

        const [isUsersUpload, isAdminOrGlobalMod] = await Promise.all([
            db.isSortedSetMembers(`uid:${callerUid}:uploads`, uploadNames),
            User.isAdminOrGlobalMod(callerUid),
        ]);
        if (!isAdminOrGlobalMod && !isUsersUpload.every(Boolean)) {
            throw new Error('[[error:no-privileges]]');
        }

        await batch.processArray(uploadNames, async (uploadName) => {
            const fullPaths = _getFullPath(uploadName);

            await Promise.all 
                ([
                    file.delete(fullPaths),
                    file.delete(file.appendToFileName(fullPaths, '-resized')),
                ]);
                await Promise.all([
                    db.sortedSetRemove(`uid:${uid}:uploads`, uploadName),
                    db.delete(`upload:${md5(uploadName)}`),
                ]);
            });

            // Dissociate the upload from pids, if any
            const pids = await db.getSortedSetsMembers(uploadNames.map(relativePath => `upload:${md5(relativePath)}:pids`));
            await Promise.all(pids.map(async (pids, idx) => Promise.all(
                pids.map(async pid => posts.uploads.dissociate(pid, uploadNames[idx]))
            )));
        }, { batch: 50 };
    };
    
    User.collateUploads = async function (uid: string, archive: any): Promise<void> {
        await batch.processSortedSet(`uid:${uid}:uploads`, (files: string[], next: () => void) => {
            files.forEach((file) => {
                archive.file(_getFullPath(file), {
                    name: path.basename(file),
                });
            });

            setImmediate(next);
        }, { batch: 100 });
    };
}