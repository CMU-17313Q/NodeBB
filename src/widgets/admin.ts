import * as webserver from '../webserver';
import * as plugins from '../plugins';
import * as groups from '../groups';
import * as index from './index';
import promisifyModule from '../promisify';

interface Area {
    name: string;
    template: string;
    location: string;
    data?: Area;
}

interface Widget {
    content: string;
}

interface Admin {
    get: () => Promise<unknown>;
    getAreas: () => Promise<Area[]>;
}

interface GroupData {
    system: boolean;
}

interface Template {
    template: string;
    areas: Area[];
}


async function renderAdminTemplate(): Promise<string> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const groupsData: GroupData[] = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1) as GroupData[];
    groupsData.sort((a, b) => (b.system ? 1 : 0) - (a.system ? 1 : 0));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return await webserver.app.renderAsync('admin/partials/widget-settings', { groups: groupsData }) as string;
}

async function getAvailableWidgets(): Promise<Widget[]> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const [widgets, adminTemplate]: [Widget[], string] = await Promise.all([
        plugins.hooks.fire('filter:widgets.getWidgets', []),
        renderAdminTemplate(),
    ]) as [Widget[], string];

    const availableWidgets = widgets.map((w) => {
        w.content += adminTemplate;
        return w;
    });

    return availableWidgets;
}

function buildTemplatesFromAreas(areas: Area[]): Template[] {
    const templates: Template[] = [];
    const list: { [key: string]: number } = {};
    let index = 0;

    areas.forEach((area) => {
        if (typeof list[area.template] === 'undefined') {
            list[area.template] = index;
            templates.push({
                template: area.template,
                areas: [],
            });

            index += 1;
        }

        templates[list[area.template]].areas.push({
            name: area.name,
            location: area.location,
            template: '',
        });
    });

    return templates;
}

const admin: Admin = {
    get: async function (): Promise<unknown> {
        const [areas, availableWidgets] = await Promise.all([
            admin.getAreas(),
            getAvailableWidgets(),
        ]);

        return {
            templates: buildTemplatesFromAreas(areas),
            areas: areas,
            availableWidgets: availableWidgets,
        };
    },

    getAreas: async function (): Promise<Area[]> {
        const defaultAreas: Area[] = [
            { name: 'Global Sidebar', template: 'global', location: 'sidebar' },
            { name: 'Global Header', template: 'global', location: 'header' },
            { name: 'Global Footer', template: 'global', location: 'footer' },
            { name: 'Group Page (Left)', template: 'groups/details.tpl', location: 'left' },
            { name: 'Group Page (Right)', template: 'groups/details.tpl', location: 'right' },
        ];

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const areas: Area[] = await plugins.hooks.fire('filter:widgets.getAreas', defaultAreas) as Area[];
        areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });

        const areaData: Area[] = await Promise.all(

            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            areas.map(async area => await index.getArea(area.template, area.location))
        ) as Area[];

        areas.forEach((area, i) => {
            area.data = areaData[i];
        });

        return areas;
    },
};

promisifyModule(admin);
