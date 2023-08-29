"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const database_1 = __importDefault(require("../database"));
const privileges_1 = __importDefault(require("../privileges"));
const search_1 = __importDefault(require("../search"));
;
function default_1(Topics) {
    Topics.getSuggestedTopics = function (tid, uid, start, stop, cutoff = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            let tids;
            cutoff = cutoff === 0 ? cutoff : (cutoff * 2592000000);
            const tagTids = yield getTidsWithSameTags(tid, cutoff);
            const searchTids = yield getSearchTids(tid, uid, cutoff);
            tids = lodash_1.default.uniq([...tagTids, ...searchTids]);
            let categoryTids = [];
            if (stop !== -1 && tids.length < stop - start + 1) {
                categoryTids = yield getCategoryTids(tid, cutoff);
            }
            tids = lodash_1.default.shuffle(lodash_1.default.uniq([...tids, ...categoryTids]));
            tids = yield privileges_1.default.topics.filterTids('topics:read', tids, uid);
            const topicData = yield Topics.getTopicsByTids(tids, uid);
            return topicData
                .filter(topic => topic && topic.tid !== tid)
                .slice(start, stop !== -1 ? stop + 1 : undefined)
                .sort((t1, t2) => (t2.timestamp || 0) - (t1.timestamp || 0));
        });
    };
    function getTidsWithSameTags(tid, cutoff) {
        return __awaiter(this, void 0, void 0, function* () {
            const tags = yield Topics.getTopicTags(tid);
            let tids;
            if (cutoff === 0) {
                tids = yield database_1.default.getSortedSetRevRange(tags.map(tag => `tag:${tag}:topics`), 0, -1);
            }
            else {
                tids = yield database_1.default.getSortedSetRevRangeByScore(tags.map(tag => `tag:${tag}:topics`), 0, -1, '+inf', Date.now() - cutoff);
            }
            return tids.filter(_tid => _tid !== tid.toString()).map(Number);
        });
    }
    function getSearchTids(tid, uid, cutoff) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield Topics.getTopicFields(tid, ['title', 'cid']);
            const searchData = yield search_1.default.search({
                query: topicData.title,
                searchIn: 'titles',
                matchWords: 'any',
                categories: [topicData.cid],
                uid: uid,
                returnIds: true,
                timeRange: cutoff !== 0 ? cutoff / 1000 : 0,
                timeFilter: 'newer',
            });
            return searchData.tids.filter(_tid => _tid !== tid).map(Number);
        });
    }
    function getCategoryTids(tid, cutoff) {
        return __awaiter(this, void 0, void 0, function* () {
            const cid = yield Topics.getTopicField(tid, 'cid');
            let tids;
            if (cutoff === 0) {
                tids = yield database_1.default.getSortedSetRevRange(`cid:${cid}:tids:lastposttime`, 0, 9);
            }
            else {
                tids = yield database_1.default.getSortedSetRevRangeByScore(`cid:${cid}:tids:lastposttime`, 0, 9, '+inf', Date.now() - cutoff);
            }
            return tids.map(Number).filter(_tid => _tid !== tid);
        });
    }
}
exports.default = default_1;
