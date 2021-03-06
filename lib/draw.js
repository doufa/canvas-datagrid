/*jslint browser: true, unparam: true, todo: true*/
/*globals XMLSerializer: false, define: true, Blob: false, MutationObserver: false, requestAnimationFrame: false, performance: false, btoa: false*/
define([], function () {
    'use strict';
    return function (self) {
        var perfCounters = [],
            drawCount = 0,
            perfWindowSize = 300,
            entityCount = [],
            scrollDebugCounters = [],
            touchPPSCounters = [];
        self.htmlImageCache = {};
        function drawPerfLine(w, h, x, y, perfArr, arrIndex, max, color, useAbs) {
            var i = w / perfArr.length,
                r = h / max;
            x += self.canvasOffsetLeft;
            y += self.canvasOffsetTop;
            self.ctx.beginPath();
            self.ctx.moveTo(x, y + h);
            perfArr.forEach(function (n) {
                var val = (arrIndex === undefined ? n : n[arrIndex]),
                    cx,
                    cy;
                if (useAbs) {
                    val = Math.abs(val);
                }
                cx = x + i;
                cy = y + h - (val * r);
                self.ctx.lineTo(cx, cy);
                x += i;
            });
            self.ctx.moveTo(x + w, y + h);
            self.ctx.strokeStyle = color;
            self.ctx.stroke();
        }
        function drawOnAllImagesLoaded() {
            var loaded = true;
            Object.keys(self.htmlImageCache).forEach(function (html) {
                if (!self.htmlImageCache[html].complete) {
                    loaded = false;
                }
            });
            if (loaded) {
                self.draw();
            }
        }
        function drawHtml(cell) {
            var img,
                v = cell.innerHTML || cell.formattedValue,
                x = cell.x + self.canvasOffsetLeft,
                y = cell.y + self.canvasOffsetTop;
            if (self.htmlImageCache[v]) {
                img = self.htmlImageCache[v];
                if (img.height !== cell.height || img.width !== cell.width) {
                    // height and width of the cell has changed, invalidate cache
                    self.htmlImageCache[v] = undefined;
                } else {
                    if (!img.complete) {
                        return;
                    }
                    return self.ctx.drawImage(img, x, y);
                }
            }
            img = new Image(cell.width, cell.height);
            self.htmlImageCache[v] = img;
            img.onload = function () {
                self.ctx.drawImage(img, x, y);
                drawOnAllImagesLoaded();
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(
                '<svg xmlns="http://www.w3.org/2000/svg" width="' + cell.width + '" height="' + cell.height + '">\n' +
                    '<foreignObject class="node" x="0" y="0" width="100%" height="100%">\n' +
                    '<body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;">\n' +
                    v + '\n' +
                    '</body>' +
                    '</foreignObject>\n' +
                    '</svg>\n'
            );
        }
        function drawOrderByArrow(x, y) {
            x += self.canvasOffsetLeft;
            y += self.canvasOffsetTop;
            self.ctx.fillStyle = self.style.columnHeaderOrderByArrowColor;
            self.ctx.strokeStyle = self.style.columnHeaderOrderByArrowBorderColor;
            self.ctx.beginPath();
            x = x + self.style.columnHeaderOrderByArrowMarginLeft;
            y = y + self.style.columnHeaderOrderByArrowMarginTop;
            if (self.orderDirection === 'asc') {
                self.ctx.moveTo(x, y);
                self.ctx.lineTo(x + self.style.columnHeaderOrderByArrowWidth, y);
                self.ctx.lineTo(x + (self.style.columnHeaderOrderByArrowWidth * 0.5), y + self.style.columnHeaderOrderByArrowHeight);
                self.ctx.moveTo(x, y);
            } else {
                self.ctx.lineTo(x, y + self.style.columnHeaderOrderByArrowHeight);
                self.ctx.lineTo(x + self.style.columnHeaderOrderByArrowWidth, y + self.style.columnHeaderOrderByArrowHeight);
                self.ctx.lineTo(x + (self.style.columnHeaderOrderByArrowWidth * 0.5), y);
                self.ctx.lineTo(x, y + self.style.columnHeaderOrderByArrowHeight);
            }
            self.ctx.stroke();
            self.ctx.fill();
            return self.style.columnHeaderOrderByArrowMarginLeft
                + self.style.columnHeaderOrderByArrowWidth
                + self.style.columnHeaderOrderByArrowMarginRight;
        }
        function drawTreeArrow(cell, x, y) {
            x += self.canvasOffsetLeft;
            y += self.canvasOffsetTop;
            self.ctx.fillStyle = self.style.treeArrowColor;
            self.ctx.strokeStyle = self.style.treeArrowBorderColor;
            self.ctx.beginPath();
            x = x + self.style.treeArrowMarginLeft;
            y = y + self.style.treeArrowMarginTop;
            if (self.openChildren[cell.data[self.uniqueId]]) {
                self.ctx.moveTo(x, y);
                self.ctx.lineTo(x + self.style.treeArrowWidth, y);
                self.ctx.lineTo(x + (self.style.treeArrowWidth * 0.5), y + self.style.treeArrowHeight);
                self.ctx.moveTo(x, y);
            } else {
                self.ctx.lineTo(x, y);
                self.ctx.lineTo(x + self.style.treeArrowHeight, y + (self.style.treeArrowWidth * 0.5));
                self.ctx.lineTo(x, y + self.style.treeArrowWidth);
                self.ctx.lineTo(x, y);
            }
            self.ctx.stroke();
            self.ctx.fill();
            return self.style.treeArrowMarginLeft
                + self.style.treeArrowWidth
                + self.style.treeArrowMarginRight;
        }
        function radiusRect(x, y, w, h, radius) {
            x += self.canvasOffsetLeft;
            y += self.canvasOffsetTop;
            var r = x + w, b = y + h;
            self.ctx.beginPath();
            self.ctx.moveTo(x + radius, y);
            self.ctx.lineTo(r - radius, y);
            self.ctx.quadraticCurveTo(r, y, r, y + radius);
            self.ctx.lineTo(r, y + h - radius);
            self.ctx.quadraticCurveTo(r, b, r - radius, b);
            self.ctx.lineTo(x + radius, b);
            self.ctx.quadraticCurveTo(x, b, x, b - radius);
            self.ctx.lineTo(x, y + radius);
            self.ctx.quadraticCurveTo(x, y, x + radius, y);
        }
        function fillRect(x, y, w, h) {
            x += self.canvasOffsetLeft;
            y += self.canvasOffsetTop;
            self.ctx.fillRect(x, y, w, h);
        }
        function strokeRect(x, y, w, h) {
            x += self.canvasOffsetLeft;
            y += self.canvasOffsetTop;
            self.ctx.strokeRect(x, y, w, h);
        }
        function fillText(text, x, y) {
            x += self.canvasOffsetLeft;
            y += self.canvasOffsetTop;
            self.ctx.fillText(text, x, y);
        }
        function fillCircle(x, y, r) {
            x += self.canvasOffsetLeft;
            y += self.canvasOffsetTop;
            self.ctx.beginPath();
            self.ctx.arc(x, y, r, 0, 2 * Math.PI);
            self.ctx.fill();
        }
        function strokeCircle(x, y, r) {
            x += self.canvasOffsetLeft;
            y += self.canvasOffsetTop;
            self.ctx.beginPath();
            self.ctx.arc(x, y, r, 0, 2 * Math.PI);
            self.ctx.stroke();
        }
        function fillHandle(x, y, r) {
            if (self.style.selectionHandleType === 'circle') {
                return fillCircle(x, y, r * 0.5);
            }
            fillRect(x - r * 0.5, y - r * 0.5, r, r);
        }
        function strokeHandle(x, y, r) {
            if (self.style.selectionHandleType === 'circle') {
                return strokeCircle(x, y, r * 0.5);
            }
            strokeRect(x - r * 0.5, y - r * 0.5, r, r);
        }
        function addselectionHandle(c, pos) {
            var hw = self.style.selectionHandleSize,
                p = {
                    tr: function () {
                        fillHandle(c.x + c.width, c.y, hw);
                        strokeHandle(c.x + c.width, c.y, hw);
                    },
                    br: function () {
                        fillHandle(c.x + c.width, c.y + c.height, hw);
                        strokeHandle(c.x + c.width, c.y + c.height, hw);
                    },
                    tl: function () {
                        fillHandle(c.x, c.y, hw);
                        strokeHandle(c.x, c.y, hw);
                    },
                    bl: function () {
                        fillHandle(c.x, c.y + c.height, hw);
                        strokeHandle(c.x, c.y + c.height, hw);
                    }
                };
            p[pos]();
        }
        function addBorderLine(c, pos) {
            self.ctx.beginPath();
            var p = {
                t: function () {
                    self.ctx.moveTo(c.x + self.canvasOffsetLeft, c.y + self.canvasOffsetTop);
                    self.ctx.lineTo(c.x + self.canvasOffsetLeft + c.width, c.y + self.canvasOffsetTop);
                },
                r: function () {
                    self.ctx.moveTo(c.x + self.canvasOffsetLeft + c.width, c.y + self.canvasOffsetTop);
                    self.ctx.lineTo(c.x + self.canvasOffsetLeft + c.width, c.y + self.canvasOffsetTop + c.height);
                },
                b: function () {
                    self.ctx.moveTo(c.x + self.canvasOffsetLeft, c.y + self.canvasOffsetTop + c.height);
                    self.ctx.lineTo(c.x + self.canvasOffsetLeft + c.width, c.y + self.canvasOffsetTop + c.height);
                },
                l: function () {
                    self.ctx.moveTo(c.x + self.canvasOffsetLeft, c.y + self.canvasOffsetTop);
                    self.ctx.lineTo(c.x + self.canvasOffsetLeft, c.y + self.canvasOffsetTop + c.height);
                }
            };
            p[pos]();
            self.ctx.stroke();
        }
        function addEllipsis(text, width) {
            var c, w = 0;
            if (self.ellipsisCache[text] && self.ellipsisCache[text][width]) {
                return self.ellipsisCache[text][width];
            }
            //TODO Add ellipsis back when there is a fast way to do it
            w = self.ctx.measureText(text).width;
            self.ellipsisCache[text] = self.ellipsisCache[text] || {};
            c = {value: text, width: w};
            self.ellipsisCache[text][width] = c;
            return c;
        }
        function drawText(cell) {
            var paddingLeft = self.style[cell.style + 'PaddingLeft'],
                paddingTop = self.style[cell.style + 'PaddingTop'],
                paddingRight = self.style[cell.style + 'PaddingRight'],
                paddingBottom = self.style[cell.style + 'PaddingBottom'],
                vPos = paddingTop + cell.height - (cell.height * 0.5),
                hPos = paddingLeft + cell.treeArrowWidth + cell.orderByArrowWidth;
            cell.text = addEllipsis(cell.formattedValue, cell.width - paddingRight - paddingLeft);
            cell.text.height = cell.fontHeight;
            if (cell.horizontalAlignment === 'right') {
                hPos = cell.width - cell.text.width - paddingRight;
            } else if (cell.horizontalAlignment === 'center') {
                hPos = (cell.width / 2) - (cell.text.width / 2);
            }
            if (cell.verticalAlignment === 'top') {
                vPos = paddingTop + cell.text.height;
            } else if (cell.verticalAlignment === 'bottom') {
                vPos = cell.height - paddingBottom - cell.text.height;
            }
            cell.text.x = cell.x + hPos;
            cell.text.y = cell.y + vPos;
            fillText(cell.text.value, cell.text.x, cell.text.y);
        }
        /**
         * Redraws the grid. No matter what the change, this is the only method required to refresh everything.
         * @memberof canvasDatagrid
         * @name draw
         * @method
         */
         // r = literal row index
         // rd = row data array
         // i = user order index
         // o = literal data index
         // y = y drawing cursor
         // x = x drawing cursor
         // s = visible schema array
         // cx = current x drawing cursor sub calculation var
         // cy = current y drawing cursor sub calculation var
         // a = static cell (like corner cell)
         // p = perf counter
         // l = data length
         // u = current cell
         // h = current height
         // w = current width
        self.draw = function (internal) {
            if (self.dispatchEvent('beforedraw', {})) { return; }
            if (!self.isChildGrid && (!self.height || !self.width)) {
                return;
            }
            if (self.isChildGrid && internal) {
                requestAnimationFrame(self.parentGrid.draw);
                return;
            }
            if (self.intf.visible === false) {
                return;
            }
            // initial values
            var checkScrollHeight, rowHeaderCell, p, cx, cy, treeGrid, rowOpen,
                rowHeight, cornerCell, y, x, c, h, w, s, r, rd, aCell,
                selectionBorders = [],
                selectionHandles = [],
                rowHeaders = [],
                l = self.data.length,
                u = self.currentCell || {},
                rowHeaderCellHeight = self.getRowHeaderCellHeight(),
                columnHeaderCellWidth = self.getColumnHeaderCellWidth(),
                cellHeight = self.style.cellHeight;
            drawCount += 1;
            p = performance.now();
            self.visibleRowHeights = [];
            // if data length has changed, there is no way to know
            if (self.data.length > self.orders.rows.length) {
                self.createRowOrders();
            }
            function drawScrollBars() {
                var v = {
                        x: 0,
                        y: 0,
                        height: 0,
                        width: 0,
                        style: 'vertical-scroll-bar'
                    },
                    n = {
                        x: 0,
                        y: 0,
                        height: 0,
                        width: 0,
                        style: 'horizontal-scroll-bar'
                    },
                    vb = {
                        x: 0,
                        y: 0,
                        height: 0,
                        width: 0,
                        style: 'vertical-scroll-box'
                    },
                    nb = {
                        x: 0,
                        y: 0,
                        height: 0,
                        width: 0,
                        style: 'horizontal-scroll-box'
                    },
                    co = {
                        x: 0,
                        y: 0,
                        height: 0,
                        width: 0,
                        isCorner: true,
                        isScrollBoxCorner: true,
                        style: 'scroll-box-corner'
                    },
                    m = (self.style.scrollBarBoxMargin * 2),
                    d = self.style.scrollBarBoxMargin * 0.5;
                self.ctx.strokeStyle = self.style.scrollBarBorderColor;
                self.ctx.lineWidth = self.style.scrollBarBorderWidth;
                // vertical
                v.x += w - self.style.scrollBarWidth - self.style.scrollBarBorderWidth - d;
                v.y += rowHeaderCellHeight;
                v.width = self.style.scrollBarWidth + self.style.scrollBarBorderWidth + d;
                v.height = h - rowHeaderCellHeight - self.style.scrollBarWidth - d - m;
                self.ctx.fillStyle = self.style.scrollBarBackgroundColor;
                fillRect(v.x, v.y, v.width, v.height + m);
                strokeRect(v.x, v.y, v.width, v.height + m);
                // vertical box
                vb.x = v.x + self.style.scrollBarBoxMargin;
                vb.y = rowHeaderCellHeight + self.style.scrollBarBoxMargin
                    + ((v.height - self.scrollBox.scrollBoxHeight)
                        * (self.scrollBox.scrollTop / self.scrollBox.scrollHeight));
                vb.width = self.style.scrollBarBoxWidth;
                vb.height = self.scrollBox.scrollBoxHeight;
                self.ctx.fillStyle = self.style.scrollBarBoxColor;
                if (/vertical/.test(u.context)) {
                    self.ctx.fillStyle = self.style.scrollBarActiveColor;
                }
                if (vb.height < v.height) {
                    radiusRect(vb.x, vb.y, vb.width, vb.height, self.style.scrollBarBoxBorderRadius);
                    self.ctx.stroke();
                    self.ctx.fill();
                }
                // horizontal
                n.x += columnHeaderCellWidth;
                n.y += h - self.style.scrollBarWidth - d;
                n.width = w - self.style.scrollBarWidth - columnHeaderCellWidth - d - m;
                n.height = self.style.scrollBarWidth + self.style.scrollBarBorderWidth + d;
                self.ctx.fillStyle = self.style.scrollBarBackgroundColor;
                fillRect(n.x, n.y, n.width + m, n.height);
                strokeRect(n.x, n.y, n.width + m, n.height);
                // horizontal box
                nb.y = n.y + self.style.scrollBarBoxMargin;
                nb.x = columnHeaderCellWidth + self.style.scrollBarBoxMargin
                    + ((n.width - self.scrollBox.scrollBoxWidth)
                        * (self.scrollBox.scrollLeft / self.scrollBox.scrollWidth));
                nb.width = self.scrollBox.scrollBoxWidth;
                nb.height = self.style.scrollBarBoxWidth;
                self.ctx.fillStyle = self.style.scrollBarBoxColor;
                if (/horizontal/.test(u.context)) {
                    self.ctx.fillStyle = self.style.scrollBarActiveColor;
                }
                if (nb.width < n.width) {
                    radiusRect(nb.x, nb.y, nb.width, nb.height, self.style.scrollBarBoxBorderRadius);
                    self.ctx.stroke();
                    self.ctx.fill();
                }
                //corner
                self.ctx.strokeStyle = self.style.scrollBarCornerBorderColor;
                self.ctx.fillStyle = self.style.scrollBarCornerBackgroundColor;
                co.x = n.x + n.width + m;
                co.y = v.y + v.height + m;
                co.width = self.style.scrollBarWidth + self.style.scrollBarBorderWidth;
                co.height = self.style.scrollBarWidth + self.style.scrollBarBorderWidth;
                radiusRect(co.x, co.y, co.width, co.height, 0);
                self.ctx.stroke();
                self.ctx.fill();
                self.visibleCells.unshift(v);
                self.visibleCells.unshift(vb);
                self.visibleCells.unshift(n);
                self.visibleCells.unshift(nb);
                self.visibleCells.unshift(co);
                self.scrollBox.bar = {
                    v: v,
                    h: n
                };
                self.scrollBox.box = {
                    v: vb,
                    h: nb
                };
            }
            function drawCell(d, rowIndex, rowOrderIndex) {
                return function drawEach(header, headerIndex, columnOrderIndex) {
                    var selectionTop, selectionLeft, selectionBottom, selectionRight,
                        cellStyle = header.style || 'cell',
                        cellGridAttributes,
                        cell,
                        isHeader = /HeaderCell/.test(cellStyle),
                        isCorner = /cornerCell/.test(cellStyle),
                        isRowHeader = 'rowHeaderCell' === cellStyle,
                        isColumnHeader = 'columnHeaderCell' === cellStyle,
                        selected = self.selections[rowOrderIndex] && self.selections[rowOrderIndex].indexOf(columnOrderIndex) !== -1,
                        hovered = self.hovers[d[self.uniqueId]] && self.hovers[d[self.uniqueId]].indexOf(columnOrderIndex) !== -1,
                        active = self.activeCell.rowIndex === rowOrderIndex && self.activeCell.columnIndex === columnOrderIndex,
                        isGrid = typeof d[header.name] === 'object' && d[header.name] !== null && d[header.name] !== undefined,
                        activeHeader = (self.orders.rows[self.activeCell.rowIndex] === rowOrderIndex
                                || self.orders.columns[self.activeCell.columnIndex] === columnOrderIndex)
                        && (columnOrderIndex === -1 || rowOrderIndex === -1)
                        ? (isRowHeader ? 'activeRowHeaderCell' : 'activeColumnHeaderCell') : false,
                        val,
                        f = self.formatters[header.type || 'string'],
                        orderByArrowSize = 0,
                        treeArrowSize = 0,
                        cellWidth = self.sizes.columns[isRowHeader ? 'cornerCell' : header[self.uniqueId]] || header.width,
                        ev = {
                            value: d[header.name],
                            row: d,
                            header: header
                        };
                    if (cellStyle === 'headerCellCap') {
                        cellWidth = w - x;
                    }
                    // if no data or schema are defined, a width is provided to the stub column
                    if (cellWidth === undefined) {
                        cellWidth = self.style.columnWidth;
                    }
                    if (x + cellWidth + self.style.cellBorderWidth < 0) {
                        x += cellWidth + self.style.cellBorderWidth;
                    }
                    if (active) {
                        cellStyle = 'activeCell';
                    }
                    if (self.visibleRows.indexOf(rowIndex) === -1 && !isHeader) {
                        self.visibleRows.push(rowIndex);
                    }
                    val = self.dispatchEvent('formatcellvalue', ev);
                    cx = x;
                    cy = y;
                    if (cellStyle === 'cornerCell') {
                        cx = 0;
                        cy = 0;
                    } else if (isRowHeader) {
                        cx = 0;
                    } else if (isHeader) {
                        cy = 0;
                    }
                    cell = {
                        type: isGrid ? 'canvas-datagrid-cell' : header.type,
                        style: cellStyle,
                        nodeType: 'canvas-datagrid-cell',
                        x: cx,
                        y: cy,
                        horizontalAlignment: self.style[cellStyle + 'HorizontalAlignment'],
                        verticalAlignment: self.style[cellStyle + 'VerticalAlignment'],
                        offsetTop: self.canvasOffsetTop + cy,
                        offsetLeft: self.canvasOffsetLeft + cx,
                        scrollTop: self.scrollBox.scrollTop,
                        scrollLeft: self.scrollBox.scrollLeft,
                        active: active || activeHeader,
                        hovered: hovered,
                        selected: selected,
                        width: cellWidth,
                        height: cellHeight,
                        offsetWidth: cellWidth,
                        offsetHeight: cellHeight,
                        parentNode: self.intf.parentNode,
                        offsetParent: self.intf.parentNode,
                        data: d,
                        isCorner: isCorner,
                        isHeader: isHeader,
                        isColumnHeader: isColumnHeader,
                        isHeaderCellCap: !!header.isHeaderCellCap,
                        isRowHeader: isRowHeader,
                        rowOpen: rowOpen,
                        header: header,
                        columnIndex: columnOrderIndex,
                        rowIndex: rowOrderIndex,
                        sortColumnIndex: headerIndex,
                        sortRowIndex: rowIndex,
                        isGrid: isGrid,
                        gridId: (self.attributes.name || '') + d[self.uniqueId] + ':' + header[self.uniqueId],
                        parentGrid: self.intf,
                        innerHTML: '',
                        activeHeader: activeHeader,
                        value: isHeader && !isRowHeader ? (header.title || header.name) : d[header.name]
                    };
                    ev.cell = cell;
                    cell.userHeight = cell.isHeader ? self.sizes.rows[-1] : rowHeight;
                    cell.userWidth = cell.isHeader ? self.sizes.columns.cornerCell : self.sizes.columns[header[self.uniqueId]];
                    cell[self.uniqueId] = d[self.uniqueId];
                    self.visibleCells.unshift(cell);
                    if (self.dispatchEvent('beforerendercell', ev)) { return; }
                    self.ctx.fillStyle = self.style[cellStyle + 'BackgroundColor'];
                    self.ctx.strokeStyle = self.style[cellStyle + 'BorderColor'];
                    self.ctx.lineWidth = self.style[cellStyle + 'BorderWidth'];
                    if (hovered) {
                        self.ctx.fillStyle = self.style[cellStyle + 'HoverBackgroundColor'];
                        self.ctx.strokeStyle = self.style[cellStyle + 'HoverBorderColor'];
                    }
                    if (selected) {
                        self.ctx.fillStyle = self.style[cellStyle + 'SelectedBackgroundColor'];
                        self.ctx.strokeStyle = self.style[cellStyle + 'SelectedBorderColor'];
                    }
                    if (activeHeader) {
                        self.ctx.fillStyle = self.style[activeHeader + 'BackgroundColor'];
                    }
                    self.dispatchEvent('rendercell', ev);
                    if (cell.isGrid) {
                        if (cell.height !== rowHeight) {
                            cell.height = rowHeight || self.style.cellHeightWithChildGrid;
                            checkScrollHeight = true;
                        }
                        cell.width = self.sizes.columns[header[self.uniqueId]] || self.style.cellWidthWithChildGrid;
                    }
                    if (rowOpen && !cell.isRowHeader) {
                        cell.height = self.sizes.rows[rd[self.uniqueId]] || self.style.cellHeight;
                    }
                    if (!cell.isGrid) {
                        fillRect(cx, cy, cell.width, cell.height);
                        strokeRect(cx, cy, cell.width, cell.height);
                    }
                    self.ctx.save();
                    radiusRect(cell.x, cell.y, cell.width, cell.height, 0);
                    self.ctx.clip();
                    self.dispatchEvent('afterrendercell', ev);
                    if (cell.height !== cellHeight && !(rowOpen && !cell.isRowHeader)) {
                        self.sizes.rows[isHeader ? -1 : d[self.uniqueId]] = cell.height;
                        checkScrollHeight = true;
                    }
                    if (cell.width !== cellWidth) {
                        self.sizes.columns[header[self.uniqueId]] = cell.width;
                        checkScrollHeight = true;
                    }
                    if (isRowHeader && self.attributes.tree) {
                        if (!self.dispatchEvent('rendertreearrow', ev)) {
                            treeArrowSize = drawTreeArrow(cell, self.style[cellStyle + 'PaddingLeft'], cy, 0);
                        }
                    }
                    if ((self.attributes.showRowNumbers && isRowHeader)
                            || !isRowHeader) {
                        if (cell.isGrid && !self.dispatchEvent('beforerendercellgrid', ev)) {
                            if (!self.childGrids[cell.gridId]) {
                                cellGridAttributes = self.args.cellGridAttributes || self.args;
                                cellGridAttributes.name = self.attributes.saveAppearance ? cell.gridId : undefined;
                                cellGridAttributes.parentNode = cell;
                                cellGridAttributes.data = d[header.name];
                                ev.cellGridAttributes = cellGridAttributes;
                                if (self.dispatchEvent('beforecreatecellgrid', ev)) { return; }
                                self.childGrids[cell.gridId] = self.createGrid(cellGridAttributes);
                                self.sizes.rows[rd[self.uniqueId]]
                                    = self.sizes.rows[rd[self.uniqueId]] || self.style.cellGridHeight;
                                checkScrollHeight = true;
                            }
                            cell.grid = self.childGrids[cell.gridId];
                            cell.grid.parentNode = cell;
                            cell.grid.visible = true;
                            cell.grid.draw();
                            self.dispatchEvent('rendercellgrid', ev);
                        } else if (!cell.isGrid) {
                            if (self.childGrids[cell.gridId]) {
                                self.childGrids[cell.gridId].parentNode.offsetHeight = 0;
                            }
                            if (isHeader && self.orderBy === header.name) {
                                if (!self.dispatchEvent('renderorderbyarrow', ev)) {
                                    orderByArrowSize = drawOrderByArrow(cx + self.style[cellStyle + 'PaddingLeft'], 0);
                                }
                            }
                            self.ctx.fillStyle = self.style[cellStyle + 'Color'];
                            if (hovered) {
                                self.ctx.fillStyle = self.style[cellStyle + 'HoverColor'];
                            }
                            if (selected) {
                                self.ctx.fillStyle = self.style[cellStyle + 'SelectedColor'];
                            }
                            if (activeHeader) {
                                self.ctx.fillStyle = self.style[activeHeader + 'Color'];
                            }
                            self.ctx.font = self.style[cellStyle + 'Font'];
                            cell.fontHeight = self.style[cellStyle + 'FontHeight'];
                            cell.treeArrowWidth = treeArrowSize;
                            cell.orderByArrowWidth = orderByArrowSize;
                            val = val !== undefined ? val : f
                                ? f(ev) : '';
                            if (val === undefined && !f) {
                                val = '';
                                console.warn('canvas-datagrid: Unknown format '
                                    + header.type + ' add a cellFormater');
                            }
                            cell.formattedValue = ((val !== undefined && val !== null) ? val : '').toString();
                            if (self.columnFilters && self.columnFilters[val] !== undefined && isHeader) {
                                cell.formattedValue = self.attributes.filterTextPrefix + val;
                            }
                            if (!self.dispatchEvent('rendertext', ev)) {
                                if (cell.innerHTML || header.type === 'html') {
                                    drawHtml(cell);
                                } else {
                                    drawText(cell);
                                }
                            }
                        }
                    }
                    if (active) {
                        aCell = cell;
                    }
                    if (selected && !isRowHeader) {
                        if ((!self.selections[cell.rowIndex - 1]
                                || self.selections[cell.rowIndex - 1].indexOf(cell.columnIndex) === -1
                                || cell.rowIndex === 0)
                                && !cell.isHeader) {
                            selectionBorders.push([cell, 't']);
                            selectionTop = true;
                        }
                        if (!self.selections[cell.rowIndex + 1]
                                || self.selections[cell.rowIndex + 1].indexOf(cell.columnIndex) === -1) {
                            selectionBorders.push([cell, 'b']);
                            selectionBottom = true;
                        }
                        if (!self.selections[cell.rowIndex] || cell.columnIndex === 0
                                || self.selections[cell.rowIndex].indexOf(cell.columnIndex - 1) === -1) {
                            selectionBorders.push([cell, 'l']);
                            selectionLeft = true;
                        }
                        if (!self.selections[cell.rowIndex] || cell.columnIndex === s.length
                                || self.selections[cell.rowIndex].indexOf(cell.columnIndex + 1) === -1) {
                            selectionBorders.push([cell, 'r']);
                            selectionRight = true;
                        }
                        if (selectionTop && selectionRight) {
                            selectionHandles.push([cell, 'tr']);
                        }
                        if (selectionBottom && selectionRight) {
                            selectionHandles.push([cell, 'br']);
                        }
                        if (selectionTop && selectionLeft) {
                            selectionHandles.push([cell, 'tl']);
                        }
                        if (selectionBottom && selectionLeft) {
                            selectionHandles.push([cell, 'bl']);
                        }
                    }
                    self.ctx.restore();
                    x += cell.width + self.style.cellBorderWidth;
                    return cell.width;
                };
            }
            function drawRowHeader(rowData, index, rowOrderIndex) {
                var a;
                if (self.attributes.showRowHeaders) {
                    x = 0;
                    rowHeaderCell = {'rowHeaderCell': index + 1 };
                    rowHeaderCell[self.uniqueId] = rowData[self.uniqueId];
                    a = {
                        name: 'rowHeaderCell',
                        width: self.style.rowHeaderCellWidth,
                        style: 'rowHeaderCell',
                        type: 'string',
                        data: rowData[self.uniqueId],
                        index: -1
                    };
                    a[self.uniqueId] = rowData[self.uniqueId];
                    rowOpen = self.openChildren[rowData[self.uniqueId]];
                    drawCell(rowHeaderCell, index, rowOrderIndex)(a, -1, -1);
                }
            }
            function drawHeaders() {
                var d, g = s.length, i, o, columnHeaderCell, header;
                rowHeaders.forEach(function (rArgs) {
                    y = rArgs[3];
                    cellHeight = rArgs[4];
                    drawRowHeader(rArgs[0], rArgs[1], rArgs[2]);
                });
                if (self.attributes.showColumnHeaders) {
                    x = (self.scrollBox.scrollLeft * -1) + self.scrollPixelLeft;
                    if (self.attributes.showRowHeaders) {
                        x += columnHeaderCellWidth;
                    }
                    y = 0;
                    // cell height might have changed during drawing
                    cellHeight = self.getRowHeaderCellHeight();
                    for (o = self.scrollIndexLeft; o < g; o += 1) {
                        i = self.orders.columns[o];
                        header = s[i];
                        d = {
                            title: header.title,
                            name: header.name,
                            width: header.width,
                            style: 'columnHeaderCell',
                            type: 'string',
                            index: o,
                            order: i
                        };
                        columnHeaderCell = {'columnHeaderCell': header.title || header.name};
                        columnHeaderCell[self.uniqueId] = 'h' + header[self.uniqueId];
                        d[self.uniqueId] = header[self.uniqueId];
                        x += drawCell(columnHeaderCell, -1, -1)(d, o, i);
                        if (x > self.width + self.scrollBox.scrollLeft) {
                            break;
                        }
                    }
                    // fill in the space right of the headers
                    if (x < w) {
                        c = {
                            name: '',
                            width: self.style.scrollBarWidth,
                            style: 'headerCellCap',
                            isHeaderCell: true,
                            isHeaderCellCap: true,
                            type: 'string',
                            index: s.length
                        };
                        c[self.uniqueId] = 'columnHeaderCell';
                        drawCell({endCap: ''}, -1, -1)(c, -1, -1);
                    }
                    // fill in the space right of the headers
                    if (self.attributes.showRowHeaders) {
                        cornerCell = {'cornerCell': '' };
                        cornerCell[self.uniqueId] = 'cornerCell';
                        x = 0;
                        c = {
                            name: 'cornerCell',
                            width: self.style.rowHeaderCellWidth,
                            style: 'cornerCell',
                            type: 'string',
                            index: -1
                        };
                        c[self.uniqueId] = 'cornerCell';
                        drawCell(cornerCell, -1, -1)(c, -1, -1);
                    }
                }
            }
            function drawRow(r, d) {
                var i, treeHeight, rowSansTreeHeight, o, g = s.length;
                if (y - (cellHeight * 2) > h) {
                    return false;
                }
                rd = self.data[r];
                rowOpen = self.openChildren[rd[self.uniqueId]];
                rowSansTreeHeight = self.sizes.rows[rd[self.uniqueId]] || self.style.cellHeight;
                treeHeight = (rowOpen ? self.sizes.trees[rd[self.uniqueId]] : 0);
                rowHeight = rowSansTreeHeight + treeHeight;
                if (y < rowHeight * -1) {
                    return false;
                }
                if (self.attributes.showRowHeaders) {
                    x += columnHeaderCellWidth;
                }
                cellHeight = rowHeight;
                for (o = self.scrollIndexLeft; o < g; o += 1) {
                    i = self.orders.columns[o];
                    x += drawCell(rd, r, d)(s[i], i, o);
                    if (x > self.width) {
                        self.scrollIndexRight = o;
                        self.scrollPixelRight = x;
                        break;
                    }
                }
                // cell height might have changed during drawing
                cellHeight = rowHeight;
                x = (self.scrollBox.scrollLeft * -1) + self.scrollPixelLeft + self.style.cellBorderWidth;
                // don't draw a tree for the new row
                treeGrid = self.childGrids[rd[self.uniqueId]];
                if (r !== self.data.length && rowOpen) {
                    treeGrid.visible = true;
                    treeGrid.parentNode = {
                        offsetTop: y + rowSansTreeHeight + self.canvasOffsetTop,
                        offsetLeft: columnHeaderCellWidth - 1 + self.canvasOffsetLeft,
                        offsetHeight: treeHeight,
                        offsetWidth: self.width - columnHeaderCellWidth - self.style.scrollBarWidth - 1,
                        offsetParent: self.intf.parentNode,
                        parentNode: self.intf.parentNode,
                        style: self.style,
                        nodeType: 'canvas-datagrid-tree',
                        scrollTop: self.scrollBox.scrollTop,
                        scrollLeft: self.scrollBox.scrollLeft,
                        rowIndex: r
                    };
                    self.visibleCells.unshift({
                        rowIndex: x,
                        columnIndex: 0,
                        y: treeGrid.parentNode.offsetTop,
                        x: treeGrid.parentNode.offsetLeft,
                        height: treeGrid.parentNode.offsetHeight,
                        width: treeGrid.parentNode.offsetWidth,
                        style: 'tree-grid',
                        type: treeGrid.parentNode.nodeType
                    });
                    treeGrid.draw();
                } else if (treeGrid) {
                    treeGrid.parentNode.offsetHeight = 0;
                    delete self.sizes.trees[rd[self.uniqueId]];
                }
                rowHeaders.push([rd, r, d, y, rowHeight]);
                self.visibleRowHeights[r] = rowHeight;
                y += cellHeight + self.style.cellBorderWidth;
                return true;
            }
            function initDraw() {
                self.visibleRows = [];
                s = self.getVisibleSchema();
                self.visibleCells = [];
                self.canvasOffsetTop = self.isChildGrid ? self.parentNode.offsetTop : 0;
                self.canvasOffsetLeft = self.isChildGrid ? self.parentNode.offsetLeft : 0;
                h = self.height;
                w = self.width;
                if (!self.isChildGrid) {
                    self.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
                }
            }
            function drawBackground() {
                radiusRect(0, 0, w, h, 0);
                self.ctx.clip();
                self.ctx.fillStyle = self.style.backgroundColor;
                fillRect(0, 0, w, h);
            }
            function drawRows() {
                var o, n, i, g = s.length;
                x = (self.scrollBox.scrollLeft * -1) + self.scrollPixelLeft + self.style.cellBorderWidth;
                y = (self.scrollBox.scrollTop * -1) + rowHeaderCellHeight + self.scrollPixelTop + self.style.cellBorderWidth;
                for (r = self.scrollIndexTop; r < l; r += 1) {
                    n = self.orders.rows[r];
                    if (!drawRow(n, r)) {
                        self.scrollIndexBottom = r;
                        self.scrollPixelBottom = y;
                        break;
                    }
                }
                if (self.attributes.showNewRow) {
                    if (self.attributes.showRowHeaders) {
                        x += columnHeaderCellWidth;
                    }
                    rowHeight = cellHeight = self.style.cellHeight;
                    rowOpen = false;
                    for (o = self.scrollIndexLeft; o < g; o += 1) {
                        i = self.orders.columns[o];
                        x += drawCell(self.newRow, self.data.length, self.data.length)(s[i], i, o);
                        if (x > self.width + self.scrollBox.scrollLeft) {
                            break;
                        }
                    }
                    rowHeaders.push([self.newRow, self.data.length, self.data.length, y, rowHeight]);
                }
            }
            function drawReorderMarkers() {
                if (!self.reorderObject) { return; }
                var b = {
                        height: self.reorderObject.height,
                        width: self.reorderObject.width,
                        x: self.reorderObject.x + self.reorderObject.dragOffset.x,
                        y: self.reorderObject.y + self.reorderObject.dragOffset.y
                    },
                    m = {
                        width: w,
                        heigth: h,
                        x: 0,
                        y: 0
                    };
                self.ctx.fillStyle = self.style.reorderMarkerBackgroundColor;
                self.ctx.lineWidth = self.style.reorderMarkerBorderWidth;
                self.ctx.strokeStyle = self.style.reorderMarkerBorderColor;
                if (self.dragMode === 'row-reorder') {
                    b.width = w;
                    b.x = 0;
                    m.width = w;
                    m.y = self.currentCell.y;
                    fillRect(b.x, b.y, b.width, b.height);
                    strokeRect(b.x, b.y, b.width, b.height);
                    self.ctx.lineWidth = self.style.reorderMarkerIndexBorderWidth;
                    self.ctx.strokeStyle = self.style.reorderMarkerIndexBorderColor;
                    if (self.currentCell.rowIndex !== self.reorderObject.rowIndex
                            && self.currentCell.rowIndex - 1 !== self.reorderObject.rowIndex) {
                        addBorderLine(m, 't');
                    }
                } else if (self.dragMode === 'column-reorder' && self.reorderObject) {
                    b.height = h;
                    b.y = 0;
                    m.height = h;
                    m.x = self.currentCell.x;
                    fillRect(b.x, b.y, b.width, b.height);
                    strokeRect(b.x, b.y, b.width, b.height);
                    self.ctx.lineWidth = self.style.reorderMarkerIndexBorderWidth;
                    self.ctx.strokeStyle = self.style.reorderMarkerIndexBorderColor;
                    if (self.currentCell.columnIndex !== self.reorderObject.columnIndex
                            && self.currentCell.columnIndex - 1 !== self.reorderObject.columnIndex) {
                        addBorderLine(m, 'l');
                    }
                }
            }
            function drawBorder() {
                self.ctx.lineWidth = self.style.gridBorderWidth;
                self.ctx.strokeStyle = self.style.gridBorderColor;
                strokeRect(0, 0, self.width, self.height);
            }
            function drawSelectionBorders() {
                self.ctx.lineWidth = self.style.selectionOverlayBorderWidth;
                self.ctx.strokeStyle = self.style.selectionOverlayBorderColor;
                selectionBorders.forEach(function (c) {
                    addBorderLine(c[0], c[1]);
                });
            }
            function drawselectionHandles() {
                if (self.mobile) {
                    self.ctx.lineWidth = self.style.selectionHandleBorderWidth;
                    self.ctx.strokeStyle = self.style.selectionHandleBorderColor;
                    self.ctx.fillStyle = self.style.selectionHandleColor;
                    selectionHandles.forEach(function (c) {
                        addselectionHandle(c[0], c[1]);
                        var az = self.attributes.touchSelectHandleZone / 2,
                            ax = c[0].x + (c[1] === 'tl' || c[1] === 'bl' ? 0 : c[0].width) - az,
                            ay = c[0].y + (c[1] === 'bl' || c[1] === 'br' ? c[0].height : 0) - az;
                        self.visibleCells.unshift({
                            x: ax,
                            y: ay,
                            height: self.style.selectionHandleSize + az,
                            width: self.style.selectionHandleSize + az,
                            style: 'selection-handle-' + c[1]
                        });
                    });
                }
            }
            function drawActiveCell() {
                if (!aCell) { return; }
                if (self.attributes.selectionMode === 'row') {
                    if (self.activeCell && self.activeCell.rowIndex === aCell.rowIndex) {
                        self.ctx.lineWidth = self.style.activeCellOverlayBorderWidth;
                        self.ctx.strokeStyle = self.style.activeCellOverlayBorderColor;
                        strokeRect(0, aCell.y, self.getHeaderWidth() + columnHeaderCellWidth, self.visibleRowHeights[aCell.rowIndex]);
                    }
                } else {
                    self.ctx.lineWidth = self.style.activeCellOverlayBorderWidth;
                    self.ctx.strokeStyle = self.style.activeCellOverlayBorderColor;
                    strokeRect(aCell.x, aCell.y, aCell.width, aCell.height);
                }
            }
            function drawPerfLines() {
                if (!self.attributes.showPerformance) { return; }
                var pw = self.width - columnHeaderCellWidth - self.style.scrollBarWidth,
                    ph = self.height - rowHeaderCellHeight - self.style.scrollBarWidth;
                if (scrollDebugCounters.length === 0) { scrollDebugCounters = self.fillArray(0, perfWindowSize, 1, function () { return [0, 0]; }); }
                if (touchPPSCounters.length === 0) { touchPPSCounters = self.fillArray(0, perfWindowSize, 1, function () { return [0, 0]; }); }
                if (entityCount.length === 0) { entityCount = self.fillArray(0, perfWindowSize, 1, 0); }
                self.ctx.lineWidth = 0.5;
                function dpl(perfArr, arrIndex, max, color, useAbs) {
                    drawPerfLine(pw, ph, columnHeaderCellWidth, rowHeaderCellHeight, perfArr, arrIndex, max, color, useAbs);
                }
                [[scrollDebugCounters, 0, self.scrollBox.scrollHeight, 'fuchsia'],
                    [scrollDebugCounters, 1, self.scrollBox.scrollWidth, 'green'],
                    [perfCounters, undefined, 100, 'red'],
                    [entityCount, undefined, 500, 'blue'],
                    [touchPPSCounters, 0, 10000, 'orange', true],
                    [touchPPSCounters, 1, 10000, 'purple', true]
                    ].forEach(function (i) { dpl.apply(null, i); });
                self.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                entityCount.pop();
                entityCount.unshift(self.visibleCells.length);
                scrollDebugCounters.pop();
                scrollDebugCounters.unshift([self.scrollBox.scrollTop, self.scrollBox.scrollLeft]);
                touchPPSCounters.pop();
                touchPPSCounters.unshift([self.yPPS, self.xPPS]);
                self.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                fillText('Red = Draw time, Blue = Entities, Fuchsia/Green = Scroll, Orange/Purple = Touch PPS', columnHeaderCellWidth + 300, rowHeaderCellHeight);
            }
            function drawDebug() {
                var d;
                if (self.attributes.showPerformance || self.attributes.debug) {
                    if (perfCounters.length === 0) { perfCounters = self.fillArray(0, perfWindowSize, 1, 0); }
                    perfCounters.pop();
                    perfCounters.unshift(performance.now() - p);
                }
                if (!self.attributes.debug) { return; }
                self.ctx.font = '11px sans-serif';
                d = {};
                d.perf = (perfCounters.reduce(function (a, b) {
                    return a + b;
                }, 0) / Math.min(drawCount, perfCounters.length)).toFixed(1);
                d.htmlImages = Object.keys(self.htmlImageCache).length;
                d.scrollBox = self.scrollBox.toString();
                d.scrollIndex = 'x: ' + self.scrollIndexLeft + ', y: ' + self.scrollIndexTop;
                d.scrollPixel = 'x: ' + self.scrollPixelLeft + ', y: ' + self.scrollPixelTop;
                d.canvasOffset = 'x: ' + self.canvasOffsetLeft + ', y: ' + self.canvasOffsetTop;
                d.touchDelta = 'x: ' + self.touchDelta.x + ', y: ' + self.touchDelta.y;
                d.touchAnimateTo = 'x: ' + self.touchAnimateTo.x + ', y: ' + self.touchAnimateTo.y;
                d.scrollAnimation = 'x: ' + self.scrollAnimation.x + ', y: ' + self.scrollAnimation.y;
                d.touchPPS = 'x: ' + self.xPPS + ', y: ' + self.yPPS;
                d.touchPPST = 'x: ' + self.xPPST + ', y: ' + self.yPPST;
                d.touchDuration = self.touchDuration;
                d.pointerLockPosition =  self.pointerLockPosition ?
                        self.pointerLockPosition.x + ', ' + self.pointerLockPosition.y : '';
                d.size = 'w: ' + self.width + ', h: ' + self.height;
                d.mouse = 'x: ' + self.mouse.x + ', y: ' + self.mouse.y;
                d.touch = !self.touchStart
                    ? '' : 'x: ' + self.touchStart.x + ', y: ' + self.touchStart.y;
                d.entities = self.visibleCells.length;
                d.hasFocus = self.hasFocus;
                d.dragMode = self.dragMode;
                if (self.currentCell) {
                    d.columnIndex = self.currentCell.columnIndex;
                    d.rowIndex = self.currentCell.rowIndex;
                    d.sortColumnIndex = self.currentCell.sortColumnIndex;
                    d.sortRowIndex = self.currentCell.sortRowIndex;
                    d.context = self.currentCell.context;
                    d.dragContext = self.currentCell.dragContext;
                    d.style = self.currentCell.style;
                    d.type = self.currentCell.type;
                }
                Object.keys(d).forEach(function (key, index) {
                    var m = key + ': ' + d[key],
                        lh = 14;
                    self.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    fillRect(columnHeaderCellWidth, lh + (index * lh), 800, lh);
                    self.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                    fillText(m, columnHeaderCellWidth + 1, rowHeaderCellHeight + (index * lh));
                });
            }
            self.ctx.save();
            initDraw();
            drawBackground();
            drawRows();
            drawSelectionBorders();
            drawselectionHandles();
            drawActiveCell();
            drawHeaders();
            drawReorderMarkers();
            drawScrollBars();
            if (checkScrollHeight) {
                self.resize(true);
            }
            drawBorder();
            drawDebug();
            drawPerfLines();
            if (self.dispatchEvent('afterdraw', {})) { return; }
            self.ctx.restore();
        };
    };
});
