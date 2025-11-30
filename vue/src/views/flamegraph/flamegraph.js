/* eslint-disable */
'use strict';

let searching = 0;
let zoomclick = null;

// 以下是公共方法
function find_child(parent, name, attr) {
    let children = parent.childNodes;
    for (let i = 0; i < children.length; i++) {
        if (children[i].tagName == name)
            return (attr != undefined) ? children[i].attributes[attr].value : children[i];
    }
    return;
}

function orig_load(e, attr) {
    if (e.attributes["_orig_" + attr] == undefined) return;
    e.attributes[attr].value = e.attributes["_orig_" + attr].value;
    e.removeAttribute("_orig_" + attr);
}

function orig_save(e, attr, val) {
    if (e.attributes["_orig_" + attr] != undefined) return;
    if (e.attributes[attr] == undefined) return;
    if (val == undefined) val = e.attributes[attr].value;
    e.setAttribute("_orig_" + attr, val);
}

function g_to_text(e) {
    var text = find_child(e, "title").firstChild.nodeValue;
    return (text)
}

function g_to_func(e) {
    var func = g_to_text(e);
    if (func != null)
        func = func.replace(/ .*/, "");
    return (func);
}

function zoom_child(e, x, ratio) {
    if (e.attributes != undefined) {
        if (e.attributes["x"] != undefined) {
            orig_save(e, "x");
            e.attributes["x"].value = (parseFloat(e.attributes["x"].value) - x - 10) * ratio + 10;
            if (e.tagName == "text") e.attributes["x"].value = find_child(e.parentNode, "rect", "x") + 3;
        }
        if (e.attributes["width"] != undefined) {
            orig_save(e, "width");
            const index = e.attributes['node-index'].value;
            const width_origin = e.attributes["width"].value;
            e.attributes["width"].value = parseFloat(width_origin) * ratio;
            e.attributes["width"].value = e.attributes["width"].value;
        }
    }

    if (e.childNodes == undefined) return;
    for (let i = 0, c = e.childNodes; i < c.length; i++) {
        zoom_child(c[i], x - 10, ratio);
    }
}

function zoom_parent(e, svg) {
    if (e.attributes) {
        if (e.attributes["x"] != undefined) {
            orig_save(e, "x");
            e.attributes["x"].value = 10;
        }
        if (e.attributes["width"] != undefined) {
            orig_save(e, "width");
            e.attributes["width"].value = parseFloat(svg.width.baseVal.value) - (10 * 2);
        }
    }
    if (e.childNodes == undefined) return;
    for (let i = 0, c = e.childNodes; i < c.length; i++) {
        zoom_parent(c[i], svg);
    }
}

function update_text(e) {
    let r = find_child(e, "rect");
    let t = find_child(e, "text");
    let w = parseFloat(r.attributes["width"].value) - 3;
    // let txt = find_child(e, "title").textContent.replace(/\([^(]*\)/, "");
    let txt = find_child(e, "title").textContent.split(' (')[0];
    t.attributes["x"].value = parseFloat(r.attributes["x"].value) + 3;

    // Smaller than this size won't fit anything
    if (w < 2 * 12 * 0.59) {
        t.textContent = "";
        return;
    }

    t.textContent = txt;
    // Fit in full text width
    if (/^ *$/.test(txt) || t.getSubStringLength(0, txt.length) < w)
        return;

    for (let x = txt.length - 2; x > 0; x--) {
        if (t.getSubStringLength(0, x + 2) <= w) {
            t.textContent = txt.substring(0, x) + "..";
            return;
        }
    }
    t.textContent = "";
}

function zoom_reset(e) {
    if (e.attributes != undefined) {
        orig_load(e, "x");
        orig_load(e, "width");
    }
    if (e.childNodes == undefined) return;
    for (let i = 0, c = e.childNodes; i < c.length; i++) {
        zoom_reset(c[i]);
    }
}

function search(term, matchedtxt, searchbtn) {
    let re = new RegExp(term);
    let el = document.getElementsByTagName("g");
    let matches = new Object();
    let maxwidth = 0;
    for (let i = 0; i < el.length; i++) {
        let e = el[i];
        if (e.attributes["class"].value != "func_g")
            continue;
        let func = g_to_func(e);
        let rect = find_child(e, "rect");
        if (rect == null) {
            // the rect might be wrapped in an anchor
            // if nameattr href is being used
            if (rect = find_child(e, "a")) {
                rect = find_child(r, "rect");
            }
        }
        if (func == null || rect == null)
            continue;

        // Save max width. Only works as we have a root frame
        let w = parseFloat(rect.attributes["width"].value);
        if (w > maxwidth)
            maxwidth = w;

        if (func.match(re)) {
            // highlight
            let x = parseFloat(rect.attributes["x"].value);
            orig_save(rect, "fill");
            rect.attributes["fill"].value =
                "rgb(230,0,230)";

            // remember matches
            if (matches[x] == undefined) {
                matches[x] = w;
            } else {
                if (w > matches[x]) {
                    // overwrite with parent
                    matches[x] = w;
                }
            }
            searching = 1;
        }
    }
    if (!searching) {
        matchedtxt.style["opacity"] = "1.0";
        matchedtxt.firstChild.nodeValue = "Matched: none";
        return;
    }

    searchbtn.style["opacity"] = "1.0";
    searchbtn.firstChild.nodeValue = "Reset Search"

    // calculate percent matched, excluding vertical overlap
    let count = 0;
    let lastx = -1;
    let lastw = 0;
    let keys = Array();
    for (let k in matches) {
        if (matches.hasOwnProperty(k))
            keys.push(k);
    }
    // sort the matched frames by their x location
    // ascending, then width descending
    keys.sort(function (a, b) {
        return a - b;
        if (a < b || a > b)
            return a - b;
        return matches[b] - matches[a];
    });
    // Step through frames saving only the biggest bottom-up frames
    // thanks to the sort order. This relies on the tree property
    // where children are always smaller than their parents.
    for (let k in keys) {
        let x = parseFloat(keys[k]);
        let w = matches[keys[k]];
        if (x >= lastx + lastw) {
            count += w;
            lastx = x;
            lastw = w;
        }
    }
    // display matched percent
    matchedtxt.style["opacity"] = "1.0";
    let pct = 100 * count / maxwidth;
    if (pct == 100)
        pct = "100"
    else
        pct = pct.toFixed(1)
    matchedtxt.firstChild.nodeValue = "Matched: " + pct + "%";
}

function reset_search() {
    var el = document.getElementsByTagName("rect");
    for (var i = 0; i < el.length; i++) {
        orig_load(el[i], "fill")
    }
}

// flamegraph 颜色
const colorMap = (function () {
    function scalarReverse(s) {
        return s.split('').reverse().join('')
    }

    function nameHash(name) {
        let vector = 0
        let weight = 1
        let max = 1
        let mod = 10
        let ord

        name = name.replace(/.(.*?)`/, '')
        let splits = name.split('')
        for (let i = 0; i < splits.length; i++) {
            ord = splits[i].charCodeAt(0) % mod
            vector += (ord / (mod++ - 1)) * weight
            max += weight
            weight *= 0.70
            if (mod > 12) break
        }

        return (1 - vector / max)
    }

    function color(type, hash, name) {
        let v1, v2, v3, r, g, b
        if (!type) return 'rgb(0, 0, 0)'

        if (hash) {
            v1 = nameHash(name)
            v2 = v3 = nameHash(scalarReverse(name))
        } else {
            v1 = Math.random() + 1
            v2 = Math.random() + 1
            v3 = Math.random() + 1
        }

        switch (type) {
            case 'hot':
                r = 205 + Math.round(50 * v3);
                g = 0 + Math.round(230 * v1);
                b = 0 + Math.round(55 * v2);
                return `rgb(${r}, ${g}, ${b})`;
            case 'mem':
                r = 0
                g = 190 + Math.round(50 * v2)
                b = 0 + Math.round(210 * v1)
                return `rgb(${r}, ${g}, ${b})`
            case 'io':
                r = 80 + Math.round(60 * v1)
                g = r
                b = 190 + Math.round(55 * v2)
                return `rgb(${r}, ${g}, ${b})`
            default:
                throw new Error('Unknown type ' + type)
        }
    }

    function colorMap(paletteMap, colorTheme, hash, func) {
        if (paletteMap[func]) return paletteMap[func]
        paletteMap[func] = color(colorTheme, hash, func)
        return paletteMap[func]
    }

    return colorMap;
})();

// 获取渲染的 context 信息
const contextify = (function () {

    function oneDecimal(x) {
        return (Math.round(x * 10) / 10)
    }

    function htmlEscape(s) {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
    }

    function contextify(parsed, opts) {
        let each = parsed.each;
        let time = parsed.time
        let timeMax = opts.timemax
        let ypadTop = opts.fontsize * 4           // pad top, include title
        let ypadBottom = opts.fontsize * 2 + 10      // pad bottom, include labels
        let xpad = 10
        let xpad2 = opts.imagewidth * 0.82
        let xpad3 = opts.imagewidth * 0.92
        let depthMax = 0
        let frameHeight = opts.frameheight
        let paletteMap = {}

        if (timeMax < time && timeMax / time > 0.02) {
            console.error('Specified timemax %d is less than actual total %d, so it will be ignored', timeMax, time)
            timeMax = Infinity
        }

        timeMax = Math.min(time, timeMax)

        let widthPerTime = (opts.imagewidth - 2 * xpad) / timeMax
        let minWidthTime = opts.minwidth / widthPerTime

        function markNarrowBlocks(nodes) {
            function mark(k) {
                let val = parsed.nodes[k]
                if (typeof val.stime !== 'number') throw new Error('Missing start for ' + k)
                if ((val.etime - val.stime) < minWidthTime) {
                    val.narrow = true
                    return
                }

                val.narrow = false
                depthMax = Math.max(val.depth, depthMax)
            }

            Object.keys(nodes).forEach(mark)
        }

        // NodeProcessor proto
        function processNode(node, index) {
            let func = node.func
            let depth = node.depth
            let etime = node.etime
            let stime = node.stime
            let factor = opts.factor
            let countName = opts.countname
            let isRoot = !func.length && depth === 0

            if (isRoot) etime = timeMax

            let samples = Math.round((etime - stime * factor) * 10) / 10
            let costTime = samples * each
            let samplesTxt = samples.toLocaleString()
            let pct
            let pctTxt
            let escapedFunc
            let name
            let sampleInfo

            if (isRoot) {
                name = 'all'
                sampleInfo = `(${samplesTxt} ${countName} ${utils.formatTime(costTime)}, 100%)`
            } else {
                pct = Math.round((100 * samples) / (timeMax * factor) * 10) / 10
                pctTxt = pct.toLocaleString()
                escapedFunc = htmlEscape(func)

                name = escapedFunc
                sampleInfo = `(${samplesTxt} ${countName} ${utils.formatTime(costTime)}), ${pctTxt}%)`
            }
            if (opts.profile.get_sample) {
              sampleInfo = opts.profile.get_sample(node, opts, timeMax)
            }

            let x1 = oneDecimal(xpad + stime * widthPerTime)
            let x2 = oneDecimal(xpad + etime * widthPerTime)
            let y1 = oneDecimal(imageHeight - ypadBottom - (depth + 1) * frameHeight + 1)
            let y2 = oneDecimal(imageHeight - ypadBottom - depth * frameHeight)

            let chars = (x2 - x1) / (opts.fontsize * opts.fontwidth)
            let showText = false
            let text

            if (chars >= 3) { // enough room to display function name?
                showText = true
                text = func.slice(0, chars)
                if (chars < func.length) text = text.slice(0, chars - 2) + '..'
                text = htmlEscape(text)
            }

            let rect_w = x2 - x1;
            let rect_h = y2 - y1;

            return {
                name: name
                , index: index
                , search: name.toLowerCase()
                , samples: sampleInfo
                , rect_x: x1
                , rect_y: y1
                , rect_w: rect_w
                , rect_h: rect_h
                , rect_fill: colorMap(paletteMap, opts.colors, opts.hash, func)
                , text: text
                , text_x: x1 + (showText ? 3 : 0)
                , text_y: 3 + (y1 + y2) / 2
                , narrow: node.narrow
                , func: htmlEscape(func)
            }
        }

        function processNodes(nodes) {
            let keys = Object.keys(nodes)
            let acc = new Array(keys.length)

            for (let i = 0; i < keys.length; i++) {
                acc[i] = processNode(nodes[keys[i]], i)
            }

            return acc
        }

        markNarrowBlocks(parsed.nodes)

        let imageHeight = (depthMax * frameHeight) + ypadTop + ypadBottom
        let ctx = Object.assign({}, opts, {
            imageheight: imageHeight
            , xpad: xpad
            , xpad2: xpad2
            , xpad3: xpad3
            , titleX: opts.imagewidth / 2
            , detailsY: imageHeight - (frameHeight / 2)
            , viewbox: `0 0 ${opts.imagewidth} ${imageHeight}`
        })

        ctx.nodes = processNodes(parsed.nodes)
        return ctx
    }

    return contextify;
})();

const utils = (function () {

    function formatTime(ts) {
        ts = !isNaN(ts) && ts || 0;
        ts = ts / 1000;
        let str = '';
        if (ts < 1e3) {
            str = `${ts.toFixed(2)} ms`;
        } else if (ts < 1e3 * 60) {
            str = `${(ts / 1e3).toFixed(2)} s`;
        } else if (ts < 1e3 * 60 * 60) {
            str = `${(ts / (1e3 * 60)).toFixed(2)} min`;
        } else if (ts < 1e3 * 60 * 60 * 60) {
            str = `${(ts / (1e3 * 60 * 60)).toFixed(2)} h`;
        } else {
            str = `${ts.toFixed(2)} ms`;
        }

        return str;
    }
    return { formatTime };
})();

function narrowify(context, opts) {
    function processNode(n) {
        n.class = n.narrow ? 'hidden' : ''
    }

    function filterNode(n) {
        return !n.narrow
    }

    if (opts.removenarrows) context.nodes = context.nodes.filter(filterNode)
    else context.nodes.forEach(processNode)
}


function _normalize_nodes(node, p, ret) {
  ret.push({
    func: node.name,
    depth: p.depth,
    stime: p.stime,
    etime: p.stime + p.fconfig.profile.get_value(node),
  })
  if (!node.children) {
    return ret;
  }
  node.children.sort(function (a, b) {
    return a.rettime < b.rettime
  })
  let tmptime = 0;
  for (let i = 0; i < node.children.length; i++) {
    let children = node.children[i];
    _normalize_nodes(children, {fconfig: p.fconfig, stime: p.stime + tmptime, depth: p.depth + 1}, ret)
    tmptime += p.fconfig.profile.get_value(children);
  }
  return ret
}
function normalize_nodes(data, ret) {
  let fconfig = data.fconfig;
  let nodes = data.data;

  return [fconfig.profile.total, _normalize_nodes(nodes, {fconfig: fconfig, stime: 0, depth: 0}, ret)]
}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: mounted
 * @descript: 计算 svg 渲染数据
 */
function mounted() {
    // 计算 svg 真实宽度
    const imagewidth = this.$refs.svg.clientWidth;
    this.flamegraphData.fconfig.imagewidth = imagewidth;
    // 传输过程中 timemax 会丢失
    this.flamegraphData.fconfig.timemax = Infinity;
    let normalize = normalize_nodes(this.flamegraphData, []);
    this.flamegraphData.parsed = {each: 1, time: normalize[0], nodes: normalize[1]};
    // 计算 svg 其余渲染数据
    const context = contextify(this.flamegraphData.parsed, this.flamegraphData.fconfig);
    narrowify(context, this.flamegraphData.fconfig);

    this.data = context;
}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: methods
 * @descript: 展示函数详情
 */
function s(info) {
    this.show = 'Function: ' + info;
}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: methods
 * @descript: 展示默认值
 */
function c() {
    this.show = 'SWT';
}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: methods
 * @descript: 放大点击处
 */
function zoom(event) {
    let node = event.currentTarget;
    let index = node.attributes['node-index'].value;
    zoomclick = index;
    if (this.need_unzoom[index]) {
        unzoom.call(this);
    }
    //let svg = document.getElementsByTagName("svg")[0];
    let svg = this.$refs.svg;
    let attr = find_child(node, "rect").attributes;
    let width = parseFloat(attr["width"].value);
    let xmin = parseFloat(attr["x"].value);
    let xmax = parseFloat(xmin + width);
    let ymin = parseFloat(attr["y"].value);
    // 计算倍率使用原来的 width
    let ratio = (svg.width.baseVal.value - 2 * 10) / parseFloat(attr["width"].value);
    let fudge = 0.0001;

    let unzoombtn = this.$refs.unzoom;
    unzoombtn.style["opacity"] = "1.0";

    let el = document.getElementsByTagName("g");
    let upstack;
    for (let i = 0; i < el.length; i++) {
        let e = el[i];
        let ei = e.attributes['node-index'].value;
        let a = find_child(e, "rect").attributes;
        let ex = parseFloat(a["x"].value);
        let ew = parseFloat(a["width"].value);
        if (0 == 0) {
            upstack = parseFloat(a["y"].value) > ymin;
        } else {
            upstack = parseFloat(a["y"].value) < ymin;
        }
        if (upstack) {
            if (ex <= xmin && (ex + ew + fudge) >= xmax) {
                e.style["opacity"] = "0.5";
                zoom_parent(e, svg);
                this.need_unzoom[e.attributes['node-index'].value] = true;
                update_text(e);
            }
            else
                e.style["display"] = "none";
        }
        else {
            if (ex < xmin || ex + fudge >= xmax) {
                e.style["display"] = "none";
            }
            else {
                zoom_child(e, xmin, ratio);
                this.need_unzoom[e.attributes['node-index'].value] = false;
                update_text(e);
            }
        }
    }
}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: methods
 * @descript: 缩小点击
 */
function unzoom() {
    let unzoombtn = this.$refs.unzoom;
    unzoombtn.style["opacity"] = "0.0";

    let el = document.getElementsByTagName("g");
    for (let i = 0; i < el.length; i++) {
        el[i].style["display"] = "block";
        el[i].style["opacity"] = "1";
        zoom_reset(el[i]);
        update_text(el[i]);
    }
}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: methods
 * @descript: 鼠标置于搜索框上
 */
function searchover(e) {
    this.$refs.search.style["opacity"] = "1.0";
}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: methods
 * @descript: 鼠标移开搜索框
 */
function searchout(e) {
    let searchbtn = this.$refs.search;
    if (searching) {
        searchbtn.style["opacity"] = "1.0";
    } else {
        searchbtn.style["opacity"] = "0.1";
    }
}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: search_prompt
 * @descript: 开始搜索
 */
function search_prompt() {
    let searchbtn = this.$refs.search;
    let matchedtxt = this.$refs.matched;
    if (!searching) {
        let term = prompt("请输入需要查询的函数名: (允许输入正则表达式，例如: ^ext4_)", "");
        if (term != null) {
            search(term, matchedtxt, searchbtn);
        }
    } else {
        reset_search();
        searching = 0;
        searchbtn.style["opacity"] = "0.1";
        searchbtn.firstChild.nodeValue = "Search"
        matchedtxt.style["opacity"] = "0.0";
        matchedtxt.firstChild.nodeValue = "";
    }
}

function set_parent_inf() {
    this.showBigPic
        ? this.$emit('hidePic')
        : this.$emit('changPic');

}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: computed
 * @descript: 函数节点展示
 */
function nodes() {
    return this.data.nodes || [];
}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: watch
 * @descript: 缩放时进行处理
 */
function showBigPic() {
    // 计算 svg 真实宽度
    const imagewidth = this.$refs.svg.clientWidth;
    this.flamegraphData.fconfig.imagewidth = imagewidth;
    // 传输过程中 timemax 会丢失
    this.flamegraphData.fconfig.timemax = Infinity;
    let normalize = normalize_nodes(this.flamegraphData, []);
    this.flamegraphData.parsed = {each: 1, time: normalize[0], nodes: normalize[1]};
    // 计算 svg 其余渲染数据
    const context = contextify(this.flamegraphData.parsed, this.flamegraphData.fconfig);
    narrowify(context, this.flamegraphData.fconfig);
    this.data = context;

    unzoom.call(this);
}

/**
 * @component: views/common/profiler/flamegraph.vue
 * @vue-data: methods
 * @descript: 保存火焰图为 SVG 文件（修复缩放问题）
 */
function saveFlamegraphOld() {
    const svgElement = this.$refs.svg;
    
    // 克隆 SVG 元素并添加完整的数据属性
    const clonedSvg = svgElement.cloneNode(true);
    
    // 为所有节点添加完整的数据属性
    const nodes = clonedSvg.querySelectorAll('.func_g');
    nodes.forEach((node, index) => {
        const originalNode = this.data.nodes[index];
        if (originalNode) {
            // 添加完整的数据属性
            node.setAttribute('data-original-x', originalNode.rect_x);
            node.setAttribute('data-original-width', originalNode.rect_w);
            node.setAttribute('data-original-height', originalNode.rect_h);
            node.setAttribute('data-original-fill', originalNode.rect_fill);
        }
    });
    
    // 添加完整的缩放状态管理
    const enhancedScript = `
    <script>
    <![CDATA[
    (function() {
        let currentZoom = null;
        let zoomStack = [];
        let originalStates = new Map();
        
        // 初始化保存原始状态
        function initializeOriginalStates() {
            const nodes = document.querySelectorAll('.func_g');
            nodes.forEach(node => {
                const rect = node.querySelector('rect');
                const text = node.querySelector('text');
                if (rect && text) {
                    originalStates.set(node, {
                        rect: {
                            x: rect.getAttribute('x'),
                            width: rect.getAttribute('width'),
                            display: rect.style.display || 'block',
                            opacity: rect.style.opacity || '1'
                        },
                        text: {
                            x: text.getAttribute('x'),
                            content: text.textContent,
                            display: text.style.display || 'block',
                            opacity: text.style.opacity || '1'
                        },
                        node: {
                            display: node.style.display || 'block',
                            opacity: node.style.opacity || '1'
                        }
                    });
                }
            });
        }
        
        // 增强的缩放函数
        function enhancedZoom(event) {
            event.stopPropagation();
            const node = event.currentTarget;
            const rect = node.querySelector('rect');
            if (!rect) return;
            
            const svg = document.querySelector('svg');
            const nodeX = parseFloat(rect.getAttribute('x'));
            const nodeWidth = parseFloat(rect.getAttribute('width'));
            const nodeY = parseFloat(rect.getAttribute('y'));
            
            // 计算缩放比例
            const ratio = (svg.width.baseVal.value - 20) / nodeWidth;
            
            // 保存当前缩放状态
            zoomStack.push({
                node: node,
                x: nodeX,
                width: nodeWidth,
                ratio: ratio
            });
            
            // 更新重置按钮
            const unzoomBtn = document.getElementById('unzoom-btn');
            if (unzoomBtn) unzoomBtn.style.opacity = "1.0";
            
            // 处理所有节点
            const allNodes = document.querySelectorAll('.func_g');
            allNodes.forEach(currentNode => {
                const currentRect = currentNode.querySelector('rect');
                if (!currentRect) return;
                
                const currentX = parseFloat(currentRect.getAttribute('x'));
                const currentWidth = parseFloat(currentRect.getAttribute('width'));
                const currentY = parseFloat(currentRect.getAttribute('y'));
                
                // 判断节点位置关系
                const isUpstack = currentY < nodeY; // 上层节点
                const isInRange = currentX >= nodeX && (currentX + currentWidth) <= (nodeX + nodeWidth);
                
                if (isUpstack) {
                    // 上层节点：半透明显示包含当前区域的父节点
                    if (currentX <= nodeX && (currentX + currentWidth) >= (nodeX + nodeWidth)) {
                        currentNode.style.opacity = "0.5";
                        currentNode.style.display = "block";
                    } else {
                        currentNode.style.display = "none";
                    }
                } else {
                    // 当前层及下层节点
                    if (currentX < nodeX || (currentX + currentWidth) > (nodeX + nodeWidth)) {
                        currentNode.style.display = "none";
                    } else {
                        // 缩放子节点
                        const newX = 10 + (currentX - nodeX) * ratio;
                        const newWidth = currentWidth * ratio;
                        
                        currentRect.setAttribute('x', newX);
                        currentRect.setAttribute('width', newWidth);
                        
                        const text = currentNode.querySelector('text');
                        if (text) {
                            text.setAttribute('x', newX + 3);
                            updateTextVisibility(currentNode);
                        }
                        
                        currentNode.style.display = "block";
                        currentNode.style.opacity = "1";
                    }
                }
            });
            
            currentZoom = node;
        }
        
        // 更新文本可见性
        function updateTextVisibility(node) {
            const rect = node.querySelector('rect');
            const text = node.querySelector('text');
            if (!rect || !text) return;
            
            const width = parseFloat(rect.getAttribute('width'));
            const originalText = node.querySelector('title').textContent.split(' (')[0];
            
            if (width < 24) {
                text.textContent = "";
                return;
            }
            
            text.textContent = originalText;
            // 简单的文本截断逻辑
            if (text.getComputedTextLength() > width - 6) {
                for (let i = originalText.length - 2; i > 0; i--) {
                    const truncated = originalText.substring(0, i) + "..";
                    text.textContent = truncated;
                    if (text.getComputedTextLength() <= width - 6) {
                        break;
                    }
                }
            }
        }
        
        // 重置缩放
        function enhancedUnzoom() {
            const unzoomBtn = document.getElementById('unzoom-btn');
            if (unzoomBtn) unzoomBtn.style.opacity = "0.0";
            
            const allNodes = document.querySelectorAll('.func_g');
            allNodes.forEach(node => {
                node.style.display = "block";
                node.style.opacity = "1";
                
                // 恢复原始属性
                const originalState = originalStates.get(node);
                if (originalState) {
                    const rect = node.querySelector('rect');
                    const text = node.querySelector('text');
                    
                    if (rect) {
                        rect.setAttribute('x', originalState.rect.x);
                        rect.setAttribute('width', originalState.rect.width);
                    }
                    
                    if (text) {
                        text.setAttribute('x', originalState.text.x);
                        text.textContent = originalState.text.content;
                    }
                }
            });
            
            zoomStack = [];
            currentZoom = null;
        }
        
        // 初始化事件监听
        function initializeEvents() {
            initializeOriginalStates();
            
            const nodes = document.querySelectorAll('.func_g');
            nodes.forEach(node => {
                node.addEventListener('click', enhancedZoom);
            });
            
            const unzoomBtn = document.getElementById('unzoom-btn');
            if (unzoomBtn) {
                unzoomBtn.addEventListener('click', enhancedUnzoom);
            }
        }
        
        // DOM 加载完成后初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeEvents);
        } else {
            initializeEvents();
        }
    })();
    ]]>
    <\/script>
    `;
    
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clonedSvg);
    
    // 添加命名空间
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    
    // 插入增强的脚本
    const defsEnd = source.indexOf('</defs>');
    if (defsEnd !== -1) {
        source = source.slice(0, defsEnd + 7) + enhancedScript + source.slice(defsEnd + 7);
    }
    
    // 修改按钮ID
    source = source.replace(/ref="unzoom"/g, 'id="unzoom-btn"');
    
    // 创建下载
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `flamegraph-${timestamp}.svg`;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    URL.revokeObjectURL(url);
}

function saveFlamegraph() {
    const svgElement = this.$refs.svg;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);
    
    // 添加命名空间
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    // 添加警告注释
    const warningComment = `<!-- 
注意：此SVG文件为静态版本，缩放功能可能无法正常工作。
建议在原始应用程序中查看完整的交互功能。
-->`;
    
    source = source.replace(/<svg[^>]*>/, '$&' + warningComment);
    
    // 创建下载
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `flamegraph-static-${timestamp}.svg`;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    URL.revokeObjectURL(url);
}

// 添加保存按钮的鼠标悬停效果
function saveover() {
    this.$refs.save.style["opacity"] = "1.0";
}

function saveout() {
    this.$refs.save.style["opacity"] = "0.1";
}

// 修改导出对象，添加新方法
export default {
    mounted,
    methods: { 
        s, c, zoom, unzoom, 
        searchover, searchout, search_prompt, 
        set_parent_inf,
        saveFlamegraph, saveover, saveout  // 新增的方法
    },
    computed: { nodes },
    watch: { showBigPic }
}
