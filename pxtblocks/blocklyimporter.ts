///<reference path='../localtypings/blockly.d.ts'/>
/// <reference path="../built/pxtlib.d.ts" />

namespace pxt.blocks {
    export function saveWorkspaceXml(ws: Blockly.Workspace): string {
        let xml = Blockly.Xml.workspaceToDom(ws);
        let text = Blockly.Xml.domToPrettyText(xml);
        return text;
    }

    export function getDirectChildren(parent: Element, tag: string) {
        const res: Element[] = [];
        for (let i = 0; i < parent.childNodes.length; i++) {
            const n = parent.childNodes.item(i) as Element;
            if (n.tagName === tag) {
                res.push(n);
            }
        }
        return res;
    }

    export function getBlocksWithType(parent: Document | Element, type: string) {
        return getChildrenWithAttr(parent, "block", "type", type);
    }

    export function getChildrenWithAttr(parent:  Document | Element, tag: string, attr: string, value: string) {
        return Util.toArray(parent.getElementsByTagName(tag)).filter(b => b.getAttribute(attr) === value);
    }

    export function getFirstChildWithAttr(parent:  Document | Element, tag: string, attr: string, value: string) {
        const res = getChildrenWithAttr(parent, tag, attr, value);
        return res.length ? res[0] : undefined;
    }

    /**
     * Loads the xml into a off-screen workspace (not suitable for size computations)
     */
    export function loadWorkspaceXml(xml: string, skipReport = false) {
        const workspace = new Blockly.Workspace();
        try {
            const dom = Blockly.Xml.textToDom(xml);
            Blockly.Xml.domToWorkspace(dom, workspace);
            return workspace;
        } catch (e) {
            if (!skipReport)
                pxt.reportException(e);
            return null;
        }
    }

    function patchFloatingBlocks(dom: Element, info: pxtc.BlocksInfo) {
        const onstarts = getBlocksWithType(dom, ts.pxtc.ON_START_TYPE);
        let onstart = onstarts.length ? onstarts[0] : undefined;
        if (onstart) { // nothing to do
            onstart.removeAttribute("deletable");
            return;
        }

        let newnodes: Element[] = [];

        const blocks: Map<pxtc.SymbolInfo> = {};
        info.blocks.forEach(b => blocks[b.attributes.blockId] = b);

        // walk top level blocks
        let node = dom.firstElementChild;
        let insertNode: Element = undefined;
        while (node) {
            const nextNode = node.nextElementSibling;
            // does this block is disable or have s nested statement block?
            const nodeType = node.getAttribute("type");
            if (!node.getAttribute("disabled") && !node.getElementsByTagName("statement").length
                && (pxt.blocks.buildinBlockStatements[nodeType] ||
                    (blocks[nodeType] && blocks[nodeType].retType == "void" && !hasArrowFunction(blocks[nodeType])))
            ) {
                // old block, needs to be wrapped in onstart
                if (!insertNode) {
                    insertNode = dom.ownerDocument.createElement("statement");
                    insertNode.setAttribute("name", "HANDLER");
                    if (!onstart) {
                        onstart = dom.ownerDocument.createElement("block");
                        onstart.setAttribute("type", ts.pxtc.ON_START_TYPE);
                        newnodes.push(onstart);
                    }
                    onstart.appendChild(insertNode);
                    insertNode.appendChild(node);

                    node.removeAttribute("x");
                    node.removeAttribute("y");
                    insertNode = node;
                } else {
                    // event, add nested statement
                    const next = dom.ownerDocument.createElement("next");
                    next.appendChild(node);
                    insertNode.appendChild(next);
                    node.removeAttribute("x");
                    node.removeAttribute("y");
                    insertNode = node;
                }
            }
            node = nextNode;
        }

        newnodes.forEach(n => dom.appendChild(n));
    }

    export function importXml(xml: string, info: pxtc.BlocksInfo, skipReport = false): string {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, "application/xml");

            if (pxt.appTarget.compile) {
                const upgrades = pxt.appTarget.compile.upgrades || [];
                // patch block types
                upgrades.filter(up => up.type == "blockId")
                    .forEach(up => Object.keys(up.map).forEach(type => {
                        getBlocksWithType(doc, type)
                            .forEach(blockNode => {
                                blockNode.setAttribute("type", up.map[type]);
                                pxt.debug(`patched block ${type} -> ${up.map[type]}`);
                            });
                    }))

                // patch block value
                upgrades.filter(up => up.type == "blockValue")
                    .forEach(up => Object.keys(up.map).forEach(k => {
                        const m = k.split('.');
                        const type = m[0];
                        const name = m[1];
                        getBlocksWithType(doc, type)
                            .reduce<Element[]>((prev, current) => prev.concat(getDirectChildren(current, "value")), [])
                            .forEach(blockNode => {
                                blockNode.setAttribute("name", up.map[k]);
                                pxt.debug(`patched block value ${k} -> ${up.map[k]}`);
                            });
                    }))
            }

            // build upgrade map
            const enums: Map<string> = {};
            for (let k in info.apis.byQName) {
                let api = info.apis.byQName[k];
                if (api.kind == pxtc.SymbolKind.EnumMember)
                    enums[api.namespace + '.' + (api.attributes.blockImportId || api.attributes.block || api.attributes.blockId || api.name)]
                        = api.namespace + '.' + api.name;
            }

            // walk through blocks and patch enums
            const blocks = doc.getElementsByTagName("block");
            for (let i = 0; i < blocks.length; ++i)
                patchBlock(info, enums, blocks[i]);

            // patch floating blocks
            patchFloatingBlocks(doc.documentElement, info);

            // serialize and return
            return new XMLSerializer().serializeToString(doc);
        }
        catch (e) {
            if (!skipReport)
                reportException(e);
            return xml;
        }
    }

    function patchBlock(info: pxtc.BlocksInfo, enums: Map<string>, block: Element): void {
        let type = block.getAttribute("type");
        let b = Blockly.Blocks[type];
        let symbol = blockSymbol(type);
        if (!symbol || !b) return;

        let params = parameterNames(symbol);
        symbol.parameters.forEach((p, i) => {
            let ptype = info.apis.byQName[p.type];
            if (ptype && ptype.kind == pxtc.SymbolKind.Enum) {
                let field = getFirstChildWithAttr(block, "field", "name", params[p.name].name);
                if (field) {
                    let en = enums[ptype.name + '.' + field.textContent];
                    if (en) field.textContent = en;
                }
                /*
<block type="device_button_event" x="92" y="77">
    <field name="NAME">Button.AB</field>
  </block>
                  */
            }
        })
    }

    /**
     * Convert blockly hue to rgb
     */
    export function convertColour(colour: string): string {
        let hue = parseInt(colour);
        if (!isNaN(hue)) {
            return Blockly.hueToRgb(hue);
        }
        return colour;
    }
}
