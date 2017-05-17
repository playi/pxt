import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"


import Cloud = pxt.Cloud;
import U = pxt.Util;

let iface: pxt.worker.Iface

export function init() {
    if (!iface) {
        iface = pxt.worker.makeWebWorker(pxt.webConfig.workerjs)
    }
}

function setDiagnostics(diagnostics: pxtc.KsDiagnostic[]) {
    let mainPkg = pkg.mainEditorPkg();

    mainPkg.forEachFile(f => f.diagnostics = [])

    let output = "";

    for (let diagnostic of diagnostics) {
        if (diagnostic.fileName) {
            output += `${diagnostic.category == ts.pxtc.DiagnosticCategory.Error ? lf("error") : diagnostic.category == ts.pxtc.DiagnosticCategory.Warning ? lf("warning") : lf("message")}: ${diagnostic.fileName}(${diagnostic.line + 1},${diagnostic.column + 1}): `;
            let f = mainPkg.filterFiles(f => f.getTypeScriptName() == diagnostic.fileName)[0]
            if (f)
                f.diagnostics.push(diagnostic)
        }

        const category = ts.pxtc.DiagnosticCategory[diagnostic.category].toLowerCase();
        output += `${category} TS${diagnostic.code}: ${ts.pxtc.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}\n`;
    }

    if (!output)
        output = U.lf("Everything seems fine!\n")


    let f = mainPkg.outputPkg.setFile("output.txt", output)
    // display total number of errors on the output file
    f.numDiagnosticsOverride = diagnostics.filter(d => d.category == ts.pxtc.DiagnosticCategory.Error).length
}

let hang = new Promise<any>(() => { })

function catchUserErrorAndSetDiags(r: any) {
    return (v: any) => {
        if (v.isUserError) {
            core.errorNotification(v.message)
            let mainPkg = pkg.mainEditorPkg();
            let f = mainPkg.outputPkg.setFile("output.txt", v.message)
            f.numDiagnosticsOverride = 1
            return r
        } else return Promise.reject(v)
    }
}

export interface CompileOptions {
    trace?: boolean;
    native?: boolean;
    debug?: boolean;
    background?: boolean; // not explicitly requested by user (hint for simulator)
    forceEmit?: boolean;
    preferredEditor?: string;
}

export function compileAsync(options: CompileOptions = {}): Promise<pxtc.CompileResult> {
    let trg = pkg.mainPkg.getTargetOptions()
    trg.isNative = options.native
    trg.preferredEditor = options.preferredEditor;
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            if (options.debug) {
                opts.breakpoints = true
                opts.justMyCode = true
            }
            if (options.trace) {
                opts.breakpoints = true
                opts.trace = true;
            }
            opts.computeUsedSymbols = true
            if (options.forceEmit)
                opts.forceEmit = true;
            if (/test=1/i.test(window.location.href))
                opts.testMode = true
            return opts
        })
        .then(compileCoreAsync)
        .then(resp => {
            let outpkg = pkg.mainEditorPkg().outputPkg

            // keep the assembly file - it is only generated when user hits "Download"
            // and is usually overwritten by the autorun very quickly, so it's impossible to see it
            let prevasm = outpkg.files[pxtc.BINARY_ASM]
            if (prevasm && !resp.outfiles[pxtc.BINARY_ASM]) {
                resp.outfiles[pxtc.BINARY_ASM] = prevasm.content
            }

            pkg.mainEditorPkg().outputPkg.setFiles(resp.outfiles)
            setDiagnostics(resp.diagnostics)

            return ensureApisInfoAsync()
                .then(() => {
                    if (!resp.usedSymbols) return resp
                    for (let k of Object.keys(resp.usedSymbols)) {
                        resp.usedSymbols[k] = U.lookup(cachedApis.byQName, k)
                    }
                    return resp
                })
        })
        .catch(catchUserErrorAndSetDiags(hang))
}

function assembleCore(src: string): Promise<{ words: number[] }> {
    return workerOpAsync("assemble", { fileContent: src })
}

export function assembleAsync(src: string) {
    let stackBase = 0x20004000
    return assembleCore(`.startaddr ${stackBase - 256}\n${src}`)
        .then(r => {
            return assembleCore(`.startaddr ${stackBase - (r.words.length + 1) * 4}\n${src}`)
                .then(rr => {
                    U.assert(rr.words.length == r.words.length)
                    return rr
                })
        })
}

function compileCoreAsync(opts: pxtc.CompileOptions): Promise<pxtc.CompileResult> {
    return workerOpAsync("compile", { options: opts })
}

export function decompileAsync(fileName: string, blockInfo?: ts.pxtc.BlocksInfo, oldWorkspace?: B.Workspace, blockFile?: string): Promise<pxtc.CompileResult> {
    let trg = pkg.mainPkg.getTargetOptions()
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            opts.ast = true;
            return decompileCoreAsync(opts, fileName)
        })
        .then(resp => {
            // try to patch event locations
            if (resp.success && blockInfo && oldWorkspace && blockFile) {
                const newXml = pxt.blocks.layout.patchBlocksFromOldWorkspace(blockInfo, oldWorkspace, resp.outfiles[blockFile]);
                resp.outfiles[blockFile] = newXml;
            }
            pkg.mainEditorPkg().outputPkg.setFiles(resp.outfiles)
            setDiagnostics(resp.diagnostics)
            return resp
        })
}

export function decompileSnippetAsync(code: string, blockInfo?: ts.pxtc.BlocksInfo): Promise<string> {
    const snippetTs = "___snippet.ts";
    const snippetBlocks = "___snippet.blocks";
    let trg = pkg.mainPkg.getTargetOptions()
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            opts.fileSystem[snippetTs] = code;
            opts.fileSystem[snippetBlocks] = "";
            opts.sourceFiles.push(snippetTs);
            opts.sourceFiles.push(snippetBlocks);
            opts.ast = true;
            return decompileCoreAsync(opts, snippetTs)
        }).then(resp => {
            return resp.outfiles[snippetBlocks]
        })
}

function decompileCoreAsync(opts: pxtc.CompileOptions, fileName: string): Promise<pxtc.CompileResult> {
    return workerOpAsync("decompile", { options: opts, fileName: fileName })
}

export function workerOpAsync(op: string, arg: pxtc.service.OpArg) {
    init()
    return iface.opAsync(op, arg)
}

let firstTypecheck: Promise<void>;
let cachedApis: pxtc.ApisInfo;
let cachedBlocks: pxtc.BlocksInfo;
let refreshApis = false;

function waitForFirstTypecheckAsync() {
    if (firstTypecheck) return firstTypecheck;
    else return typecheckAsync();
}

function ensureApisInfoAsync(): Promise<void> {
    if (refreshApis || !cachedApis)
        return workerOpAsync("apiInfo", {})
            .then(apis => {
                refreshApis = false;
                return ts.pxtc.localizeApisAsync(apis, pkg.mainPkg);
            }).then(apis => {
                cachedApis = apis;
            })
    else return Promise.resolve()
}

export function apiSearchAsync(searchFor: pxtc.service.SearchOptions) {
    return ensureApisInfoAsync()
        .then(() => workerOpAsync("apiSearch", { search: searchFor }));
}

export function formatAsync(input: string, pos: number) {
    return workerOpAsync("format", { format: { input: input, pos: pos } });
}

export function typecheckAsync() {
    let p = pkg.mainPkg.getCompileOptionsAsync()
        .then(opts => {
            opts.testMode = true // show errors in all top-level code
            return workerOpAsync("setOptions", { options: opts })
        })
        .then(() => workerOpAsync("allDiags", {}))
        .then(setDiagnostics)
        .then(ensureApisInfoAsync)
        .catch(catchUserErrorAndSetDiags(null))
    if (!firstTypecheck) firstTypecheck = p;
    return p;
}

export function getApisInfoAsync() {
    return waitForFirstTypecheckAsync()
        .then(() => cachedApis)
}

export function getBlocksAsync(): Promise<pxtc.BlocksInfo> {
    return cachedBlocks
        ? Promise.resolve(cachedBlocks)
        : getApisInfoAsync().then(info => cachedBlocks = pxtc.getBlocksInfo(info));
}

export function newProject() {
    firstTypecheck = null;
    cachedApis = null;
    cachedBlocks = null;
    workerOpAsync("reset", {}).done();
}
