/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../typings/globals/node/index.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

export class TestHost implements pxt.Host {
    //Global cache of module files
    static files: pxt.Map<pxt.Map<string>> = {}

    constructor(public name: string, public main: string, public extraDependencies: string[], private includeCommon = false) { }

    resolve(module: pxt.Package, filename: string): string {
        return ""
    }

    readFile(module: pxt.Package, filename: string): string {
        if (TestHost.files[module.id] && TestHost.files[module.id][filename]) {
            return TestHost.files[module.id][filename]
        }
        if (module.id == "this") {
            if (filename == "pxt.json") {
                return JSON.stringify({
                    "name": this.name,
                    "dependencies": this.dependencies,
                    "description": "",
                    "files": this.includeCommon ? [
                        "main.blocks", //TODO: Probably don't want this
                        "main.ts",
                        "pxt-core.d.ts",
                        "pxt-helpers.ts"
                    ] : [
                        "main.blocks", //TODO: Probably don't want this
                        "main.ts",
                    ]
                })
            }
            else if (filename == "main.ts") {
                return this.main
            }
        } else if (pxt.appTarget.bundledpkgs[module.id] && filename === pxt.CONFIG_NAME) {
            return pxt.appTarget.bundledpkgs[module.id][pxt.CONFIG_NAME];
        } else {
            let p0 = path.join(module.id, filename);
            let p1 = path.join('libs', module.id, filename)
            let p2 = path.join('libs', module.id, 'built', filename)

            let contents: string = null

            try {
                contents = fs.readFileSync(p0, 'utf8')
            }
            catch (e) {
                try {
                    contents = fs.readFileSync(p1, 'utf8')
                }
                catch (e) {
                    //console.log(e)
                    try {
                        contents = fs.readFileSync(p2, 'utf8')
                    }
                    catch (e) {
                        //console.log(e)
                    }
                }
            }

            if (contents) {
                this.writeFile(module, filename, contents)
                return contents
            }
        }

        if (filename === "pxt-core.d.ts") {
            const contents = fs.readFileSync(path.resolve("libs", "pxt-common", "pxt-core.d.ts"), 'utf8');
            this.writeFile(module, filename, contents);
            return contents;
        }
        else if (filename === "pxt-helpers.ts") {
            const contents = fs.readFileSync(path.resolve("libs", "pxt-common", "pxt-helpers.ts"), 'utf8');
            this.writeFile(module, filename, contents);
            return contents;
        }

        return ""
    }

    writeFile(module: pxt.Package, filename: string, contents: string) {
        if (!TestHost.files[module.id]) {
            TestHost.files[module.id] = {}
        }
        TestHost.files[module.id][filename] = contents
    }

    getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
        //console.log(`getHexInfoAsync(${extInfo})`);
        return Promise.resolve<any>(null)
    }

    cacheStoreAsync(id: string, val: string): Promise<void> {
        //console.log(`cacheStoreAsync(${id}, ${val})`)
        return Promise.resolve()
    }

    cacheGetAsync(id: string): Promise<string> {
        //console.log(`cacheGetAsync(${id})`)
        return Promise.resolve("")
    }

    downloadPackageAsync(pkg: pxt.Package): Promise<void> {
        //console.log(`downloadPackageAsync(${pkg.id})`)
        return Promise.resolve()
    }

    resolveVersionAsync(pkg: pxt.Package): Promise<string> {
        //console.log(`resolveVersionAsync(${pkg.id})`)
        return Promise.resolve("*")
    }

    private get dependencies(): { [key: string]: string } {
        let stdDeps: { [key: string]: string } = {}
        for (let extraDep of this.extraDependencies) {
            stdDeps[extraDep] = `file:../${extraDep}`
        }
        return stdDeps
    }
}