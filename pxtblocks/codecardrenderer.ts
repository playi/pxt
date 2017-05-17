namespace pxt.docs.codeCard {

    const repeat = pxt.Util.repeatMap;

    export interface CodeCardRenderOptions {
        hideHeader?: boolean;
        shortName?: boolean;
    }

    export function render(card: pxt.CodeCard, options: CodeCardRenderOptions = {}): HTMLElement {
        const repeat = pxt.Util.repeatMap;
        let color = card.color || "";
        if (!color) {
            if (card.hardware && !card.software) color = 'black';
            else if (card.software && !card.hardware) color = 'teal';
        }
        const url = card.url ? /^[^:]+:\/\//.test(card.url) ? card.url : ('/' + card.url.replace(/^\.?\/?/, ''))
            : undefined;
        const link = !!url;
        const div = (parent: HTMLElement, cls: string, tag = "div", text: string | number = ''): HTMLElement => {
            let d = document.createElement(tag);
            if (cls)
                d.className = cls;
            if (parent) parent.appendChild(d);
            if (text) d.appendChild(document.createTextNode(text + ''));
            return d;
        }
        const a = (parent: HTMLElement, href: string, text: string, cls: string): HTMLAnchorElement => {
            let d = document.createElement('a');
            d.className = cls;
            d.href = href;
            d.appendChild(document.createTextNode(text));
            d.target = '_blank';
            parent.appendChild(d);
            return d;
        }

        let r = div(null, 'ui card ' + (card.color || '') + (link ? ' link' : ''), link ? "a" : "div");
        if (url) (r as HTMLAnchorElement).href = url;
        if (!options.hideHeader && (card.header || card.blocks || card.javascript || card.hardware || card.software || card.any)) {
            let h = div(r, "ui content " + (card.responsive ? " tall desktop only" : ""));
            let hr = div(h, "right floated meta")
            if (card.any) div(hr, "ui grey circular label tiny", "i", card.any > 0 ? card.any : "");
            repeat(card.blocks, (k) => div(hr, "puzzle orange icon", "i"));
            repeat(card.javascript, (k) => div(hr, "align left blue icon", "i"));
            repeat(card.hardware, (k) => div(hr, "certificate black icon", "i"));
            repeat(card.software, (k) => div(hr, "square teal icon", "i"));

            if (card.header) div(h, 'description', 'span', card.header);
        }

        let img = div(r, "ui image" + (card.responsive ? " tall landscape only" : ""));

        if (card.label) {
            let lbl = document.createElement("label");
            lbl.className = "ui orange right ribbon label";
            lbl.innerText = card.label;
            img.appendChild(lbl);
        }

        if (card.blocksXml) {
            let svg = pxt.blocks.render(card.blocksXml);
            if (!svg) {
                console.error("failed to render blocks");
                pxt.debug(card.blocksXml);
            } else {
                let holder = div(img, ''); holder.setAttribute('style', 'width:100%; min-height:10em');
                holder.appendChild(svg);
            }
        }

        if (card.typeScript) {
            let pre = document.createElement("pre");
            pre.appendChild(document.createTextNode(card.typeScript));
            img.appendChild(pre);
        }

        if (card.imageUrl) {
            let image = document.createElement("img") as HTMLImageElement;
            image.className = "ui image";
            image.src = card.imageUrl;
            img.appendChild(image)
        }

        if (card.youTubeId) {
            let screenshot = document.createElement("img") as HTMLImageElement;
            screenshot.className = "ui image";
            screenshot.src = `https://img.youtube.com/vi/${card.youTubeId}/maxresdefault.jpg`;
            img.appendChild(screenshot)
        }

        const name = (options.shortName ? card.shortName : '') || card.name;
        if (name || card.description) {
            let ct = div(r, "ui content");
            if (name) {
                if (url && !link) a(ct, url, name, 'header');
                else div(ct, 'header', 'div', name);
            }
            if (card.time) {
                let meta = div(ct, "ui meta");
                let m = div(meta, "date", "span");
                m.appendChild(document.createTextNode(pxt.Util.timeSince(card.time)));
            }
            if (card.description) {
                let descr = div(ct, 'ui description');
                descr.appendChild(document.createTextNode(card.description.split('.')[0] + '.'));
            }
        }

        return r;
    }
}