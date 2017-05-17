namespace ts.pxtc.ir {
    let U = pxtc.Util;
    let assert = U.assert;

    export enum EK {
        None,
        NumberLiteral,
        PointerLiteral,
        RuntimeCall,
        ProcCall,
        SharedRef,
        SharedDef,
        FieldAccess,
        Store,
        CellRef,
        Incr,
        Decr,
        Sequence,
        JmpValue,
        Nop,
    }

    export class Node {
        _id: number;
        isExpr(): this is Expr { return false }
        isStmt(): this is Stmt { return false }
    }

    export class Expr extends Node {
        public jsInfo: string;
        public totalUses: number; // how many references this expression has; only for the only child of Shared
        public currUses: number;
        public callingConvention = CallingConvention.Plain;

        constructor(
            public exprKind: EK,
            public args: Expr[],
            public data: any
        ) {
            super();
        }

        static clone(e: Expr) {
            let copy = new Expr(e.exprKind, e.args.slice(0), e.data)
            if (e.jsInfo)
                copy.jsInfo = e.jsInfo
            if (e.totalUses) {
                copy.totalUses = e.totalUses
                copy.currUses = e.currUses
            }
            copy.callingConvention = e.callingConvention
            return copy
        }

        isExpr() { return true }

        isPure() {
            return this.isStateless() || this.exprKind == EK.CellRef;
        }

        isStateless() {
            switch (this.exprKind) {
                case EK.NumberLiteral:
                case EK.PointerLiteral:
                case EK.SharedRef:
                    return true;
                default: return false;
            }
        }

        sharingInfo(): string {
            let arg0: ir.Expr = this
            if (this.exprKind == EK.SharedRef || this.exprKind == EK.SharedDef) {
                arg0 = this.args[0]
                if (!arg0) arg0 = { currUses: "", totalUses: "" } as any
            }
            return `${arg0.currUses}/${arg0.totalUses}`
        }

        toString(): string {
            return nodeToString(this)
        }

        canUpdateCells(): boolean {
            switch (this.exprKind) {
                case EK.NumberLiteral:
                case EK.PointerLiteral:
                case EK.CellRef:
                case EK.JmpValue:
                case EK.SharedRef:
                case EK.Nop:
                    return false;

                case EK.SharedDef:
                case EK.Incr:
                case EK.Decr:
                case EK.FieldAccess:
                    return this.args[0].canUpdateCells()

                case EK.RuntimeCall:
                case EK.ProcCall:
                case EK.Sequence:
                    return true;

                case EK.Store:
                    return true;

                default: throw oops();
            }
        }
    }


    export enum SK {
        None,
        Expr,
        Label,
        Jmp,
        StackEmpty,
        Breakpoint,
    }

    export enum JmpMode {
        Always = 1,
        IfZero,
        IfNotZero,
        IfJmpValEq,
    }

    export class Stmt extends Node {
        public lblName: string;
        public lbl: Stmt;
        public lblNumUses: number;
        public jmpMode: JmpMode;
        public lblId: number;
        public breakpointInfo: Breakpoint;
        public stmtNo: number;
        public findIdx: number;
        public terminateExpr: Expr;

        constructor(
            public stmtKind: SK,
            public expr: Expr
        ) {
            super()
        }

        isStmt() { return true }

        toString(): string {
            return nodeToString(this)
        }
    }

    let currExprId = 0
    function nodeToString(n: Node) {
        return str(n)
        function addId(n: Node) {
            if (!n._id) n._id = ++currExprId
        }
        function str(n: Node): string {
            addId(n)
            if (n.isExpr()) {
                let e = n as Expr
                let a0 = e.args ? e.args[0] : null
                switch (e.exprKind) {
                    case EK.NumberLiteral:
                        return e.data + ""
                    case EK.PointerLiteral:
                        return e.data + ""
                    case EK.CellRef:
                        return (e.data as Cell).toString()
                    case EK.JmpValue:
                        return "JMPVALUE"
                    case EK.Nop:
                        return "NOP"

                    case EK.SharedRef:
                        addId(a0)
                        return `SHARED_REF(#${a0._id})`

                    case EK.SharedDef:
                        addId(a0)
                        return `SHARED_DEF(#${a0._id}: ${str(a0)})`

                    case EK.Incr:
                        return `INCR(${str(a0)})`

                    case EK.Decr:
                        return `DECR(${str(a0)})`

                    case EK.FieldAccess:
                        return `${str(a0)}.${(e.data as FieldAccessInfo).name}`

                    case EK.RuntimeCall:
                        return e.data + "(" + e.args.map(str).join(", ") + ")"

                    case EK.ProcCall:
                        let procid = e.data as ProcId
                        let name = ""
                        if (procid.ifaceIndex != null) name = `IFACE@${procid.ifaceIndex}`
                        else if (procid.virtualIndex != null) name = `VTABLE@${procid.virtualIndex}`
                        else name = getDeclName(procid.proc.action)
                        return name + "(" + e.args.map(str).join(", ") + ")"

                    case EK.Sequence:
                        return "(" + e.args.map(str).join("; ") + ")"

                    case EK.Store:
                        return `{ ${str(e.args[0])} := ${str(e.args[1])} }`

                    default: throw oops();
                }
            } else {
                let stmt = n as Stmt
                let inner = stmt.expr ? str(stmt.expr) : "{null}"
                switch (stmt.stmtKind) {
                    case ir.SK.Expr:
                        return "    " + inner + "\n"
                    case ir.SK.Jmp:
                        let fin = `goto ${stmt.lblName}\n`
                        switch (stmt.jmpMode) {
                            case JmpMode.Always:
                                if (stmt.expr)
                                    return `    { JMPVALUE := ${inner} } ${fin}`
                                else return "    " + fin
                            case JmpMode.IfZero:
                                return `    if (! ${inner}) ${fin}`
                            case JmpMode.IfNotZero:
                                return `    if (${inner}) ${fin}`
                            case JmpMode.IfJmpValEq:
                                return `    if (r0 == ${inner}) ${fin}`
                            default: throw oops();
                        }
                    case ir.SK.StackEmpty:
                        return "    ;\n"
                    case ir.SK.Breakpoint:
                        return "    // brk " + (stmt.breakpointInfo.id) + "\n"
                    case ir.SK.Label:
                        return stmt.lblName + ":\n"
                    default: throw oops();
                }

            }
        }
    }

    export class Cell {
        isarg = false;
        iscap = false;
        _isRef = false;
        _isLocal = false;
        _isGlobal = false;
        _debugType = "?";
        bitSize = BitSize.None;

        constructor(public index: number, public def: Declaration, public info: VariableAddInfo) {
            if (def && info) {
                setCellProps(this)
            }
        }

        getName() {
            return getDeclName(this.def)
        }

        getDebugInfo(): CellInfo {
            return {
                name: this.getName(),
                type: this._debugType,
                index: this.index,
            }
        }

        toString() {
            let n = ""
            if (this.def) n += this.getName() || "?"
            if (this.isarg) n = "ARG " + n
            if (this.isRef()) n = "REF " + n
            //if (this.isByRefLocal()) n = "BYREF " + n
            return "[" + n + "]"
        }

        uniqueName() {
            if (this.isarg)
                return "arg" + this.index // have to keep names stable for inheritance
            return this.getName().replace(/[^\w]/g, "_") + "___" + getNodeId(this.def)
        }

        refSuffix() {
            if (this.isRef()) return "Ref"
            else return ""
        }

        isRef() { return this._isRef }
        isLocal() { return this._isLocal }
        isGlobal() { return this._isGlobal }

        loadCore() {
            return op(EK.CellRef, null, this)
        }

        load() {
            let r = this.loadCore()

            if (target.taggedInts && this.bitSize != BitSize.None) {
                if (this.bitSize == BitSize.UInt32)
                    return rtcall("pxt::fromUInt", [r])
                return rtcall("pxt::fromInt", [r])
            }

            if (this.isByRefLocal())
                return rtcall("pxtrt::ldloc" + this.refSuffix(), [r])

            if (this.refCountingHandledHere())
                return op(EK.Incr, [r])

            return r
        }

        refCountingHandledHere() {
            return this.isRef() && !this.isByRefLocal()
        }

        isByRefLocal() {
            return this.isLocal() && this.info.captured && this.info.written
        }

        storeDirect(src: Expr) {
            return op(EK.Store, [this.loadCore(), src])
        }

        storeByRef(src: Expr) {
            if (this.isByRefLocal()) {
                return rtcall("pxtrt::stloc" + this.refSuffix(), [this.loadCore(), src])
            } else {
                if (target.taggedInts && this.bitSize != BitSize.None) {
                    src = shared(src)
                    let cnv = this.bitSize == BitSize.UInt32 ? "pxt::toUInt" : "pxt::toInt"
                    let iv = shared(rtcall(cnv, [src]))
                    return op(EK.Sequence, [
                        iv,
                        op(EK.Decr, [src]),
                        this.storeDirect(iv)
                    ])
                }

                if (this.refCountingHandledHere()) {
                    let tmp = shared(src)
                    return op(EK.Sequence, [
                        tmp,
                        op(EK.Decr, [this.loadCore()]),
                        this.storeDirect(tmp)
                    ])
                } else {
                    return this.storeDirect(src)
                }
            }
        }

        get isTemporary(): boolean {
            return false
        }
    }

    //Cells that represent variables that are generated by the compiler as temporaries
    //The user cannot access these cells from JS or blocks
    export class UnnamedCell extends Cell {
        private static unnamedCellCounter = 0
        private uid: number

        constructor(public index: number, public owningProc: Procedure) {
            super(index, null, null)
            this.uid = UnnamedCell.unnamedCellCounter++
        }

        getName() {
            return "unnamed" + this.uid
        }

        uniqueName() {
            return this.getName() + "___U" + this.index
        }

        isByRefLocal() {
            return false
        }

        get isTemporary(): boolean {
            return true
        }
    }

    export interface ProcId {
        proc: Procedure;
        virtualIndex: number;
        ifaceIndex: number;
        mapMethod?: string;
        mapIdx?: number;
    }

    export interface ProcQuery {
        action: ts.FunctionLikeDeclaration;
        bindings: TypeBinding[];
    }

    function noRefCount(e: ir.Expr): boolean {
        switch (e.exprKind) {
            case ir.EK.Sequence:
                return noRefCount(e.args[e.args.length - 1])
            case ir.EK.NumberLiteral:
                return true
            case ir.EK.RuntimeCall:
                switch (e.data as string) {
                    case "String_::mkEmpty":
                    case "pxt::ptrOfLiteral":
                        return true
                    default:
                        return false
                }
            case ir.EK.SharedDef:
            case ir.EK.SharedRef:
                return noRefCount(e.args[0])
            default:
                return false
        }
    }

    export class Procedure extends Node {
        numArgs = 0;
        info: FunctionAddInfo;
        seqNo: number;
        isRoot = false;
        locals: Cell[] = [];
        captured: Cell[] = [];
        args: Cell[] = [];
        parent: Procedure;
        debugInfo: ProcDebugInfo;
        bindings: TypeBinding[];
        fillDebugInfo: (th: assembler.File) => void;
        classInfo: ClassInfo;

        body: Stmt[] = [];
        lblNo = 0;
        action: ts.FunctionLikeDeclaration;

        reset() {
            this.body = []
            this.lblNo = 0
            this.locals = []
            this.captured = []
            this.args = []
        }

        label() {
            return getFunctionLabel(this.action, this.bindings)
        }

        matches(id: ProcQuery) {
            if (this.action == id.action) {
                U.assert(this.bindings.length == id.bindings.length, "this.bindings.length == id.bindings.length")
                for (let i = 0; i < this.bindings.length; ++i)
                    if (this.bindings[i].isRef != id.bindings[i].isRef)
                        return false
                return true
            }
            return false
        }

        toString(): string {
            return `\nPROC ${getDeclName(this.action)}\n${this.body.map(s => s.toString()).join("")}\n`
        }

        emit(stmt: Stmt) {
            this.body.push(stmt)
        }

        emitExpr(expr: Expr) {
            this.emit(stmt(SK.Expr, expr))
        }

        mkLabel(name: string) {
            let lbl = stmt(SK.Label, null)
            lbl.lblName = "." + name + "_" + this.lblNo++ + "_" + this.seqNo
            lbl.lbl = lbl
            return lbl
        }
        emitLbl(lbl: Stmt) {
            this.emit(lbl)
        }
        emitLblDirect(lblName: string) {
            let lbl = stmt(SK.Label, null)
            lbl.lblName = lblName
            lbl.lbl = lbl
            this.emit(lbl)
        }

        getName() {
            let text = this.action && this.action.name ? (<Identifier>this.action.name).text : null
            return text || "inline"
        }

        mkLocal(def: Declaration, info: VariableAddInfo) {
            let l = new Cell(this.locals.length, def, info)
            this.locals.push(l)
            return l
        }

        mkLocalUnnamed(isRef = false) {
            let uc = new UnnamedCell(this.locals.length, this);
            uc._isRef = isRef
            this.locals.push(uc)
            return uc
        }

        localIndex(l: Declaration, noargs = false): Cell {
            return this.captured.filter(n => n.def == l)[0] ||
                this.locals.filter(n => n.def == l)[0] ||
                (noargs ? null : this.args.filter(n => n.def == l)[0])
        }

        stackEmpty() {
            this.emit(stmt(SK.StackEmpty, null))
        }

        emitClrIfRef(p: Cell) {
            assert(!p.isGlobal() && !p.iscap, "!p.isGlobal() && !p.iscap")
            if (p.isRef() || p.isByRefLocal()) {
                this.emitExpr(op(EK.Decr, [p.loadCore()]))
            }
        }

        emitClrs() {
            if (this.isRoot) return;
            let lst = this.locals.concat(this.args)
            lst.forEach(p => this.emitClrIfRef(p))
        }

        emitJmpZ(trg: string | Stmt, expr: Expr) {
            this.emitJmp(trg, expr, JmpMode.IfZero)
        }

        emitJmp(trg: string | Stmt, expr?: Expr, mode = JmpMode.Always, terminate: Expr = null) {
            let jmp = stmt(SK.Jmp, expr)

            jmp.jmpMode = mode;
            if (terminate && terminate.exprKind == EK.NumberLiteral)
                terminate = null
            jmp.terminateExpr = terminate

            if (typeof trg == "string")
                jmp.lblName = trg as any
            else {
                jmp.lbl = trg as Stmt
                jmp.lblName = jmp.lbl.lblName
            }

            this.emit(jmp)
        }

        resolve() {
            let iterargs = (e: Expr, f: (v: Expr) => Expr) => {
                if (e.args)
                    for (let i = 0; i < e.args.length; ++i)
                        e.args[i] = f(e.args[i])
            }

            let refdef = (e: Expr): Expr => {
                switch (e.exprKind) {
                    case EK.SharedDef: throw U.oops();
                    case EK.SharedRef:
                        let arg = e.args[0]
                        if (!arg.totalUses) {
                            arg.totalUses = -1
                            arg.currUses = 0
                            let e2 = Expr.clone(e)
                            e2.exprKind = EK.SharedDef
                            e2.args[0] = refdef(e2.args[0])
                            return e2
                        } else {
                            arg.totalUses--;
                            return e
                        }
                }

                iterargs(e, refdef)

                return e
            }

            let opt = (e: ir.Expr): ir.Expr => {
                if (e.exprKind == EK.SharedRef)
                    return e;

                iterargs(e, opt)

                if ((e.exprKind == EK.Decr || e.exprKind == EK.Incr) && noRefCount(e.args[0])) {
                    return e.args[0]
                }

                switch (e.exprKind) {
                    case EK.Decr:
                        if (e.args[0].exprKind == EK.Incr)
                            return e.args[0].args[0]
                        break;
                    case EK.Sequence:
                        e.args = e.args.filter((a, i) => i == e.args.length - 1 || !a.isPure())
                        break;
                }

                return e
            }

            let cntuses = (e: Expr): Expr => {
                switch (e.exprKind) {
                    case EK.SharedDef:
                        let arg = e.args[0]
                        //console.log(arg)
                        U.assert(arg.totalUses < 0, "arg.totalUses < 0")
                        U.assert(arg.currUses === 0, "arg.currUses === 0")
                        if (arg.totalUses == -1)
                            return cntuses(arg)
                        else
                            arg.totalUses = 1;
                        break;
                    case EK.SharedRef:
                        U.assert(e.args[0].totalUses > 0, "e.args[0].totalUses > 0")
                        e.args[0].totalUses++;
                        return e;
                }
                iterargs(e, cntuses)
                return e
            }

            this.body = this.body.filter(s => {
                if (s.expr) {
                    //console.log("OPT", s.expr.toString())
                    s.expr = opt(refdef(s.expr))
                    //console.log("INTO", s.expr.toString())
                    if (s.stmtKind == ir.SK.Expr && s.expr.isPure())
                        return false;
                }
                return true
            })

            let lbls = U.toDictionary(this.body.filter(s => s.stmtKind == ir.SK.Label), s => s.lblName)

            for (let i = 0; i < this.body.length; ++i)
                this.body[i].stmtNo = i

            for (let s of this.body) {
                if (s.expr) {
                    //console.log("CNT", s.expr.toString())
                    s.expr = cntuses(s.expr)
                }

                switch (s.stmtKind) {
                    case ir.SK.Expr:
                        break;
                    case ir.SK.Jmp:
                        s.lbl = U.lookup(lbls, s.lblName)
                        if (!s.lbl) oops("missing label: " + s.lblName)
                        s.lbl.lblNumUses++
                        break;
                    case ir.SK.StackEmpty:
                    case ir.SK.Label:
                    case ir.SK.Breakpoint:
                        break;
                    default: oops();
                }
            }

            let allBrkp: Breakpoint[] = []

            for (let s of this.body) {
                if (s.stmtKind == ir.SK.Breakpoint) {
                    allBrkp[s.breakpointInfo.id] = s.breakpointInfo
                }
            }

            let debugSucc = false
            if (debugSucc) {
                let s = "BRKP: " + this.getName() + ":\n"
                for (let i = 0; i < allBrkp.length; ++i) {
                    let b = allBrkp[i]
                    if (!b) continue

                    s += `${b.line + 1}: `
                    let n = allBrkp[i + 1]
                    s += "\n"
                }
                console.log(s)
            }
        }
    }

    export function iterExpr(e: Expr, f: (v: Expr) => void) {
        f(e)
        if (e.args)
            for (let a of e.args)
                iterExpr(a, f)
    }

    export function stmt(kind: SK, expr: Expr): Stmt {
        return new Stmt(kind, expr)
    }

    export function op(kind: EK, args: Expr[], data?: any): Expr {
        return new Expr(kind, args, data)
    }

    export function numlit(v: number | boolean): Expr {
        return op(EK.NumberLiteral, null, v)
    }

    export function shared(expr: Expr) {
        switch (expr.exprKind) {
            case EK.NumberLiteral:
            case EK.SharedRef:
                return expr;
        }
        return op(EK.SharedRef, [expr])
    }

    export function ptrlit(lbl: string, jsInfo: string, full = false): Expr {
        let r = op(EK.PointerLiteral, null, lbl)
        r.jsInfo = jsInfo
        if (full) {
            if (target.nativeType == "AVR")
                return rtcall("pxt::ptrOfLiteral", [r])
            else
                r.args = []
        }
        return r
    }

    export function rtcall(name: string, args: Expr[]) {
        return op(EK.RuntimeCall, args, name)
    }

    export function rtcallMask(name: string, mask: number, callingConv: CallingConvention, args: Expr[]) {
        let decrs: ir.Expr[] = []
        args = args.map((a, i) => {
            if (mask & (1 << i)) {
                a = shared(a)
                decrs.push(op(EK.Decr, [a]))
                return a;
            } else return a;
        })
        let r = op(EK.RuntimeCall, args, name)
        r.callingConvention = callingConv

        if (decrs.length > 0) {
            r = shared(r)
            decrs.unshift(r)
            decrs.push(r)
            r = op(EK.Sequence, decrs)
        }

        return r
    }

    export function flattenArgs(topExpr: ir.Expr) {
        let didStateUpdate = false
        let complexArgs: ir.Expr[] = []
        for (let a of U.reversed(topExpr.args)) {
            if (a.isStateless()) continue
            if (a.exprKind == EK.CellRef && !didStateUpdate) continue
            if (a.canUpdateCells()) didStateUpdate = true
            complexArgs.push(a)
        }
        complexArgs.reverse()
        let precomp: ir.Expr[] = []
        let flattened = topExpr.args.map(a => {
            let idx = complexArgs.indexOf(a)
            if (idx >= 0) {
                let sharedRef = a
                let sharedDef = a
                if (a.exprKind == EK.SharedDef) {
                    a.args[0].totalUses++
                    sharedRef = ir.op(EK.SharedRef, [a.args[0]])
                } else {
                    sharedRef = ir.op(EK.SharedRef, [a])
                    sharedDef = ir.op(EK.SharedDef, [a])
                    a.totalUses = 2
                    a.currUses = 0
                }
                precomp.push(sharedDef)
                return sharedRef
            } else return a
        })

        return { precomp, flattened }
    }


}
