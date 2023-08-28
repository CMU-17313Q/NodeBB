// Imports
import db from '../database';
import meta from '../meta';
import plugins from '../plugins';
import utils from '../utils';

// Helper function to escape HTML characters
function escapeHtml(input: string): string {
    return input.replace(/&(?!\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Array of fields with integer values
const intFields: string[] = [
    'cid', 'parentCid', 'disabled', 'isSection', 'order',
    'topic_count', 'post_count', 'numRecentReplies',
    'minTags', 'maxTags', 'postQueue', 'subCategoriesPerPage',
];

// Interface for a single Category object
interface Category {
    [key: string]: unknown;
}

// Interface for the Categories object containing various methods
interface Categories {
    getCategoriesFields(cids: number[], fields: string[]): Promise<Category[]>;
    getCategoryData(cid: number): Promise<Category | null>;
    getCategoriesData(cids: number[]): Promise<Category[]>;
    getCategoryField(cid: number, field: string): Promise<unknown>;
    getCategoryFields(cid: number, fields: string[]): Promise<Category | null>;
    getAllCategoryFields(fields: string[]): Promise<Category[]>;
    setCategoryField(cid: number, field: string, value: unknown): Promise<void>;
    incrementCategoryFieldBy(cid: number, field: string, value: number): Promise<void>;
    getAllCidsFromSet(set: string): Promise<number[]>;
}

// Exported function that attaches methods to the Categories object
export = function (Categories: Categories) {
    Categories.getCategoriesFields = async function (cids, fields) {
        if (!Array.isArray(cids) || !cids.length) {
            return [];
        }

        const keys = cids.map(cid => `category:${cid}`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const categories: string[] = await db.getObjects(keys, fields) as string[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result = await plugins.hooks.fire('filter:category.getFields', {
            cids: cids,
            categories: categories,
            fields: fields,
            keys: keys,
        }) as { cids: number[]; categories: Category[]; fields: string[]; keys: string[] };

        function defaultIntField(category: Category, fields: string[], fieldName: string, defaultField: string) {
            if (!fields.length || fields.includes(fieldName)) {
                const useDefault = !category.hasOwnProperty(fieldName) ||
                    category[fieldName] === null ||
                    category[fieldName] === '' ||
                    !utils.isNumber(category[fieldName]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                category[fieldName] = useDefault ? meta.config[defaultField] : category[fieldName];
            }
        }
        function modifyCategory(category: Category, fields: string[]): void {
            if (!category) {
                return;
            }
            defaultIntField(category, fields, 'minTags', 'minimumTagsPerTopic');
            defaultIntField(category, fields, 'maxTags', 'maximumTagsPerTopic');
            defaultIntField(category, fields, 'postQueue', 'postQueue');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.parseIntFields(category, intFields, fields);

            const escapeFields = ['name', 'color', 'bgColor', 'backgroundImage', 'imageClass', 'class', 'link'];
            escapeFields.forEach((field) => {
                if (category.hasOwnProperty(field)) {
                    category[field] = escapeHtml(String(category[field] || ''));
                }
            });

            if (category.hasOwnProperty('icon')) {
                category.icon = category.icon || 'hidden';
            }

            if (category.hasOwnProperty('post_count')) {
                category.totalPostCount = category.post_count;
            }

            if (category.hasOwnProperty('topic_count')) {
                category.totalTopicCount = category.topic_count;
            }

            if (category.description) {
                category.description = escapeHtml(String(category.description));
                category.descriptionParsed = category.descriptionParsed || category.description;
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const modifiedCategories: Category[] = result.categories.map((category: Category) => {
            modifyCategory(category, fields);
            return category;
        });

        return modifiedCategories;
    };
    // functions within the Category interface
    Categories.getCategoryData = async function (cid) {
        const categories = await Categories.getCategoriesFields([cid], []);
        return categories && categories.length ? categories[0] : null;
    };

    Categories.getCategoriesData = async function (cids) {
        return await Categories.getCategoriesFields(cids, []);
    };

    Categories.getCategoryField = async function (cid, field) {
        const category = await Categories.getCategoryFields(cid, [field]);
        return category ? category[field] : null;
    };

    Categories.getCategoryFields = async function (cid, fields) {
        const categories = await Categories.getCategoriesFields([cid], fields);
        return categories ? categories[0] : null;
    };

    Categories.getAllCategoryFields = async function (fields) {
        const cids = await Categories.getAllCidsFromSet('categories:cid');
        return await Categories.getCategoriesFields(cids, fields);
    };

    Categories.setCategoryField = async function (cid, field, value) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObjectField(`category:${cid}`, field, value);
    };

    Categories.incrementCategoryFieldBy = async function (cid, field, value) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.incrObjectFieldBy(`category:${cid}`, field, value);
    };
};
