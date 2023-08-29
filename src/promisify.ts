import util from 'util';
/*
             eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
              @typescript-eslint/no-explicit-any
             */
type Module = Record<string, any>;
/*
             eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
              @typescript-eslint/no-explicit-any
             */
type CallbackFunction = (...args: null[]) => void;
/*
             eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
              @typescript-eslint/no-explicit-any
             */
type PromisifiedFunction = (...args: any[]) => Promise<any>;
/*
             eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
              @typescript-eslint/no-explicit-any
             */
export function isCallbackedFunction(func: CallbackFunction): boolean {
    if (typeof func !== 'function') {
        return false;
    }
    const str = func.toString().split('\n')[0];
    return str.includes('callback)');
}
function wrapCallback(origFn: CallbackFunction): PromisifiedFunction {
    return util.promisify(origFn);
}

export default function promisifyModule(theModule: Module, ignoreKeys: string[] = []): void {
    function promisifyRecursive(module: Module): void {
        const keys = Object.keys(module);
        keys.forEach((key) => {
            if (ignoreKeys.includes(key)) {
                return;
            }
            /*
            eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
            @typescript-eslint/no-unsafe-argument
            */
            if (isCallbackedFunction(module[key])) {
                /*
                eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                @typescript-eslint/no-unsafe-argument
                */
                module[key] = wrapCallback(module[key]);
                /*
                eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                @typescript-eslint/no-unsafe-argument
                */
            } else if (typeof module[key] === 'object' && module[key] !== null) {
                /*
                eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                @typescript-eslint/no-unsafe-argument
                */
                promisifyRecursive(module[key]);
            }
        });
    }
    promisifyRecursive(theModule);
}
