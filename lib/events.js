/*jslint browser: true, unparam: true, todo: true, plusplus: true*/
/*globals define: true, MutationObserver: false, requestAnimationFrame: false, performance: false, btoa: false*/
define([], function () {
    'use strict';
    return function (self) {
        var wheeling,
            touchTimerMs = 50,
            touchScrollTimeout;
        self.scrollAnimation = {};
        self.touchDelta = {};
        self.touchAnimateTo = {};
        self.animationFrames = 0;
        function calculateCssSize(sizeString, parentSize) {
            var p;
            if (sizeString === 'auto' || sizeString === '') { return parentSize; }
            if (/%/.test(sizeString)) {
                p = parseFloat(sizeString, 10);
                return parentSize * (p * 0.01);
            }
            return parseFloat(sizeString, 10);
        }
        self.getTouchPos = function (e) {
            var rect = self.canvas.getBoundingClientRect(),
                pos = {
                    x: e.touches[0].clientX - rect.left,
                    y: e.touches[0].clientY - rect.top
                };
            if (self.isChildGrid) {
                pos.x -= self.canvasOffsetLeft;
                pos.y -= self.canvasOffsetTop;
            }
            return {
                x: pos.x,
                y: pos.y,
                rect: rect
            };
        };
        // shamelessly stolen from from https://gist.github.com/gre/1650294
        self.easingFunctions = {
            linear: function (t) { return t; },
            easeInQuad: function (t) { return t * t; },
            easeOutQuad: function (t) { return t * (2 - t); },
            easeInOutQuad: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
            easeInCubic: function (t) { return t * t * t; },
            easeOutCubic: function (t) { return (--t) * t * t + 1; },
            easeInOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; },
            easeInQuart: function (t) { return t * t * t * t; },
            easeOutQuart: function (t) { return 1 - (--t) * t * t * t; },
            easeInOutQuart: function (t) { return t < 0.5 ? 8 * t  * t  * t * t : 1 - 8 * (--t) * t * t * t; },
            easeInQuint: function (t) { return t * t * t * t * t; },
            easeOutQuint: function (t) { return 1 + (--t) * t *  t * t * t; },
            easeInOutQuint: function (t) { return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t; }
        };
        self.easing = function (t, b, c, d) {
            return c * self.easingFunctions[self.attributes.touchEasingMethod](t / d) + b;
        };
        self.calculatePPSTimed = function () {
            self.xPPST = -((self.touchDelta.x - self.touchSigmaTimed.x) / (self.touchDelta.t - self.touchSigmaTimed.t));
            self.yPPST = -((self.touchDelta.y - self.touchSigmaTimed.y) / (self.touchDelta.t - self.touchSigmaTimed.t));
            self.touchSigmaTimed = {
                x: self.touchDelta.x,
                y: self.touchDelta.y,
                t: performance.now()
            };
        };
        self.calculatePPS = function () {
            self.xPPS = -((self.touchDelta.x - self.touchSigma.x) / (self.touchDelta.t - self.touchSigma.t));
            self.yPPS = -((self.touchDelta.y - self.touchSigma.y) / (self.touchDelta.t - self.touchSigma.t));
            self.touchSigma = {
                x: self.touchDelta.x,
                y: self.touchDelta.y,
                t: performance.now()
            };
        };
        self.touchEndAnimation = function () {
            if (!self.canvas || !self.scrollBox.scrollTo) { return requestAnimationFrame(self.touchEndAnimation); }
            var n = performance.now(),
                d = self.attributes.touchReleaseAnimationDurationMs,
                t;
            t = n - self.touchDelta.t;
            self.animationFrames += 1;
            self.scrollAnimation.x = self.easing(t, self.touchDelta.scrollLeft, self.touchAnimateTo.x, d);
            self.scrollAnimation.y = self.easing(t, self.touchDelta.scrollTop, self.touchAnimateTo.y, d);
            if (t > d || (self.scrollAnimation.y === self.scrollBox.scrollTop
                    && self.scrollAnimation.x === self.scrollBox.scrollLeft) || self.stopAnimation) {
                return;
            }
            self.scrollBox.scrollTo(self.scrollAnimation.x, self.scrollAnimation.y);
            requestAnimationFrame(self.touchEndAnimation);
        };
        self.touchEditCell = function (cell) {
            self.beginEditAt(cell.columnIndex, cell.rowIndex);
        };
        self.touchCell = function (e) {
            return function () {
                clearInterval(self.calculatePPSTimer);
                var i, pos = self.getTouchPos(e);
                if (Math.abs(self.touchDelta.x) + Math.abs(self.touchDelta.y) < self.attributes.touchDeadZone) {
                    i = self.getCellAt(pos.x, pos.y);
                    if (!i) { return; }
                    if (self.touchingCell && self.touchingCell.rowIndex === i.rowIndex
                            && self.touchingCell.columnIndex === i.columnIndex) {
                        self.touchEditCell(i);
                        return;
                    }
                    if (self.input) {
                        self.endEdit();
                    }
                    self.touchingCell = i;
                    self.selectArea({
                        top: i.rowIndex,
                        bottom: i.rowIndex,
                        left: i.columnIndex,
                        right: i.columnIndex
                    });
                    self.draw();
                }
            };
        };
        self.touchstart = function (e) {
            if (self.dispatchEvent('touchstart', {NativeEvent: e})) { return; }
            self.disposeContextMenu();
            clearInterval(self.calculatePPSTimer);
            clearTimeout(self.touchContextTimeout);
            self.touchStartEvent = e;
            self.stopAnimation = true;
            self.animationFrames = 0;
            self.stopPropagation(e);
            e.preventDefault();
            self.touchStart = self.getTouchPos(e);
            self.touchScrollStart = {
                x: self.scrollBox.scrollLeft,
                y: self.scrollBox.scrollTop,
                t: performance.now()
            };
            self.touchDelta = {
                x: 0,
                y: 0,
                scrollLeft: self.scrollBox.scrollLeft,
                scrollTop: self.scrollBox.scrollTop,
                t: self.touchScrollStart.t
            };
            self.touchSigma = {
                x: self.touchDelta.x,
                y: self.touchDelta.y,
                t: self.touchDelta.t
            };
            self.touchSigmaTimed = {
                x: self.touchDelta.x,
                y: self.touchDelta.y,
                t: self.touchDelta.t
            };
            self.touchContextTimeout = setTimeout(function () {
                self.contextmenuEvent(e, self.touchStart);
            }, self.attributes.touchContextMenuTimeMs);
            self.calculatePPSTimer = setInterval(self.calculatePPSTimed, touchTimerMs);
            self.startingCell = self.getCellAt(self.touchStart.x, self.touchStart.y, true);
            if (self.startingCell.isHeader) {
                if (self.startingCell.isRowHeader) {
                    self.selectArea({
                        top: self.startingCell.rowIndex,
                        bottom: self.startingCell.rowIndex,
                        left: 0,
                        right: self.getSchema().length - 1,
                    });
                    self.draw();
                } else if (self.startingCell.isColumnHeader) {
                    if (self.attributes.columnHeaderClickBehavior === 'sort') {
                        if (self.orderBy === self.startingCell.header.name) {
                            self.orderDirection = self.orderDirection === 'asc' ? 'desc' : 'asc';
                        } else {
                            self.orderDirection = 'asc';
                        }
                        self.order(self.startingCell.header.name, self.orderDirection);
                    }
                    if (self.attributes.columnHeaderClickBehavior === 'select') {
                        self.selectArea({
                            top: 0,
                            bottom: self.data.length - 1,
                            left: self.startingCell.columnIndex,
                            right: self.startingCell.columnIndex,
                        });
                        self.draw();
                    }
                }
                self.touchEndEvents(e);
                return;
            }
            document.body.addEventListener('touchmove', self.touchmove, {passive: false});
            document.body.addEventListener('touchend', self.touchend, false);
            document.body.addEventListener('touchcancel', self.touchcancel, false);
            self.draw();
        };
        self.touchSelect = function (cell, handleType) {
            if (cell.rowIndex === undefined || cell.columnIndex === undefined) { return; }
            self.touchSelecting = true;
            var bounds = self.getSelectionBounds();
            if (handleType === 'selection-handle-bl'
                    && cell.rowIndex >= bounds.top
                    && cell.columnIndex <= bounds.right) {
                bounds.bottom = cell.rowIndex;
                bounds.left = cell.columnIndex;
            } else if (handleType === 'selection-handle-tl'
                    && cell.rowIndex <= bounds.bottom
                    && cell.columnIndex <= bounds.right) {
                bounds.top = cell.rowIndex;
                bounds.left = cell.columnIndex;
            } else if (handleType === 'selection-handle-tr'
                    && cell.rowIndex <= bounds.bottom
                    && cell.columnIndex >= bounds.left) {
                bounds.top = cell.rowIndex;
                bounds.right = cell.columnIndex;
            } else if (handleType === 'selection-handle-br'
                    && cell.rowIndex >= bounds.top
                    && cell.columnIndex >= bounds.left) {
                bounds.bottom = cell.rowIndex;
                bounds.right = cell.columnIndex;
            }
            if (self.attributes.selectionMode === 'row' || cell.rowIndex === -1) {
                bounds.left = 0;
                bounds.right = self.getSchema().length - 1;
            } else {
                bounds.left = Math.max(0, bounds.left);
            }
            self.selectArea(bounds);
            self.draw();
        };
        self.touchmove = function (e) {
            if (self.dispatchEvent('touchmove', {NativeEvent: e})) { return; }
            clearTimeout(touchScrollTimeout);
            clearTimeout(self.touchContextTimeout);
            self.touchPosition = self.getTouchPos(e);
            var rh = self.getRowHeaderCellHeight(),
                cw = self.getColumnHeaderCellWidth(),
                rScrollZone = self.width - self.style.scrollBarWidth - self.touchPosition.x < self.attributes.selectionScrollZone,
                lScrollZone = self.touchPosition.x - cw < self.attributes.selectionScrollZone,
                bScrollZone = self.height - self.style.scrollBarWidth - self.touchPosition.y < self.attributes.selectionScrollZone,
                tScrollZone = self.touchPosition.y - rh < self.attributes.selectionScrollZone,
                sbw = self.style.scrollBarWidth;
            function touchScroll() {
                var x = self.scrollBox.scrollLeft,
                    y = self.scrollBox.scrollTop;
                x += (rScrollZone ? self.attributes.selectionScrollIncrement : 0);
                y += (bScrollZone ? self.attributes.selectionScrollIncrement : 0);
                y -= (tScrollZone ? self.attributes.selectionScrollIncrement : 0);
                x -= (lScrollZone ? self.attributes.selectionScrollIncrement : 0);
                self.scrollBox.scrollTo(x, y);
                touchScrollTimeout = setTimeout(touchScroll, self.attributes.scrollRepeatRate);
            }
            e.stopPropagation();
            self.touchDelta = {
                x: self.touchPosition.x - self.touchStart.x,
                y: self.touchPosition.y - self.touchStart.y,
                scrollLeft: self.scrollBox.scrollLeft,
                scrollTop: self.scrollBox.scrollTop,
                t: performance.now()
            };
            self.currentCell = self.getCellAt(self.touchPosition.x, self.touchPosition.y);
            self.calculatePPS();
            self.touchDuration = performance.now() - self.touchScrollStart.t;
            self.stopAnimation = true;
            self.animationFrames = 0;
            if (self.touchSelecting && (rScrollZone || lScrollZone || tScrollZone || bScrollZone)) {
                touchScroll();
            }
            if (/vertical-scroll-/.test(self.startingCell.style)) {
                self.scrollBox.scrollTop = self.scrollBox.scrollHeight
                    * ((self.touchPosition.y - rh - sbw) / (self.scrollBox.height - sbw - rh));
                return;
            }
            if (/horizontal-scroll-/.test(self.startingCell.style)) {
                self.scrollBox.scrollLeft = self.scrollBox.scrollWidth
                    * ((self.touchPosition.x - cw - sbw) / (self.scrollBox.width - sbw - cw));
                return;
            }
            if (/selection-handle-/.test(self.startingCell.style)) {
                self.touchSelect(self.currentCell, self.startingCell.style);
                return;
            }
            self.scrollBox.scrollTo(self.touchScrollStart.x - self.touchDelta.x,
                self.touchScrollStart.y - self.touchDelta.y);
            self.draw();
        };
        self.touchEndEvents = function (e) {
            self.touchSelecting = false;
            clearInterval(self.touchScrollTimeout);
            clearInterval(self.touchContextTimeout);
            clearInterval(self.calculatePPSTimer);
            e.stopPropagation();
            document.body.removeEventListener('touchmove', self.touchmove, {passive: false});
            document.body.removeEventListener('touchend', self.touchend, false);
            document.body.removeEventListener('touchcancel', self.touchcancel, false);
        };
        self.touchend = function (e) {
            if (self.dispatchEvent('touchend', {NativeEvent: e})) { return; }
            var dz = Math.abs(self.touchDelta.x) + Math.abs(self.touchDelta.y) < self.attributes.touchDeadZone;
            if (isNaN(self.xPPS)) {
                self.xPPS = 0;
            }
            if (isNaN(self.yPPS)) {
                self.yPPS = 0;
            }
            if (isNaN(self.xPPST)) {
                self.xPPST = 0;
            }
            if (isNaN(self.yPPST)) {
                self.yPPST = 0;
            }
            self.touchAnimateTo.x = self.xPPS * self.attributes.touchReleaseAcceleration;
            self.touchAnimateTo.y = self.yPPS * self.attributes.touchReleaseAcceleration;
            self.calculatePPSTimed();
            if (dz && !self.contextMenu) {
                self.touchCell(self.touchStartEvent)();
            } else if (self.animationFrames === 0
                    && (Math.abs(self.xPPST) > self.attributes.scrollAnimationPPSThreshold
                        || Math.abs(self.yPPST) > self.attributes.scrollAnimationPPSThreshold)
                    && !/-scroll-/.test(self.startingCell.style)
                    && !dz) {
                self.stopAnimation = false;
                self.touchEndAnimation();
            }
            self.touchEndEvents(e);
        };
        self.touchcancel = function (e) {
            if (self.dispatchEvent('touchcancel', {NativeEvent: e})) { return; }
            self.touchEndEvents(e);
        };
        self.stopPropagation = function (e) { e.stopPropagation(); };
        self.addEventListener = function (ev, fn) {
            self.events[ev] = self.events[ev] || [];
            self.events[ev].unshift(fn);
        };
        self.removeEventListener = function (ev, fn) {
            (self.events[ev] || []).forEach(function removeEachListener(sfn, idx) {
                if (fn === sfn) {
                    self.events[ev].splice(idx, 1);
                }
            });
        };
        self.dispatchEvent = function (ev, e) {
            var defaultPrevented;
            function preventDefault() {
                defaultPrevented = true;
            }
            if (!self.events[ev]) { return; }
            self.events[ev].forEach(function dispatchEachEvent(fn) {
                e.ctx = self.ctx;
                e.preventDefault = preventDefault;
                fn.apply(self.intf, [e]);
            });
            return defaultPrevented;
        };
        self.resizeDomElement = function () {
            if (!self.parentIsCanvas) {
                if (self.shadowRootParentElement) {
                    // shadow dom browsers
                    self.width = calculateCssSize(self.style.width, self.shadowRootParentElement.offsetWidth);
                    self.height = calculateCssSize(self.style.height, self.shadowRootParentElement.offsetHeight);
                    // self.intf.style.width = self.height + 'px';
                    // self.intf.style.height = self.height + 'px';
                } else {
                    // pre shadow dom browsers
                    self.width = self.parentDOMNode.offsetWidth;
                    self.height = self.parentDOMNode.offsetHeight;
                }
                self.canvas.style.width = self.width + 'px';
                self.canvas.style.height = self.height + 'px';
                self.canvas.width = self.width * window.devicePixelRatio;
                self.canvas.height = self.height * window.devicePixelRatio;
            }
            self.canvasOffsetLeft = self.args.canvasOffsetLeft || 0;
            self.canvasOffsetTop = self.args.canvasOffsetTop || 0;
        };
        self.resize = function (drawAfterResize) {
            var cellBorder = self.style.cellBorderWidth * 2,
                columnHeaderCellBorder =  self.style.columnHeaderCellBorderWidth * 2,
                scrollHeight,
                scrollWidth,
                rowHeaderCellHeight = self.getRowHeaderCellHeight(),
                columnHeaderCellWidth = self.getColumnHeaderCellWidth(),
                // TODO: What the hell are these numbers!?  They are probably some value in the style.
                scrollDragPositionOffsetY = 30,
                scrollDragPositionOffsetX = 15;
            if (self.isChildGrid) {
                self.width = self.parentNode.offsetWidth;
                self.height = self.parentNode.offsetHeight;
            } else {
                self.resizeDomElement();
            }
            scrollHeight = self.data.reduce(function reduceData(accumulator, row) {
                return accumulator
                    + (self.sizes.rows[row[self.uniqueId]] || self.style.cellHeight)
                    + (self.sizes.trees[row[self.uniqueId]] || 0)
                    + cellBorder;
            }, 0) || 0;
            scrollWidth = self.getVisibleSchema().reduce(function reduceSchema(accumulator, column) {
                if (column.hidden) { return accumulator; }
                return accumulator + (self.sizes.columns[column[self.uniqueId]] || column.width || self.style.columnWidth) + cellBorder;
            }, 0) || 0;
            if (self.attributes.showNewRow) {
                scrollHeight += self.style.cellHeight + cellBorder;
            }
            self.scrollBox.width = self.width - columnHeaderCellWidth;
            self.scrollBox.height = self.height - rowHeaderCellHeight - columnHeaderCellBorder;
            self.scrollBox.top = rowHeaderCellHeight + columnHeaderCellBorder;
            self.scrollBox.left = columnHeaderCellWidth;
            self.scrollBox.scrollHeight = scrollHeight + self.style.scrollBarWidth - self.scrollBox.height;
            self.scrollBox.scrollWidth = scrollWidth + self.style.scrollBarWidth - self.scrollBox.width;
            self.scrollBox.widthBoxRatio = ((self.scrollBox.width - scrollDragPositionOffsetX)
                / (self.scrollBox.scrollWidth + self.scrollBox.width - scrollDragPositionOffsetX));
            self.scrollBox.scrollBoxWidth = self.scrollBox.width
                * self.scrollBox.widthBoxRatio
                - self.style.scrollBarWidth;
            self.scrollBox.heightBoxRatio = ((self.scrollBox.height - scrollDragPositionOffsetY)
                / (self.scrollBox.scrollHeight + (self.scrollBox.height - scrollDragPositionOffsetY)));
            self.scrollBox.scrollBoxHeight = self.scrollBox.height
                * self.scrollBox.heightBoxRatio
                - self.style.scrollBarWidth;
            self.scrollBox.scrollBoxWidth = Math.max(self.scrollBox.scrollBoxWidth, self.style.scrollBarBoxMinSize);
            self.scrollBox.scrollBoxHeight = Math.max(self.scrollBox.scrollBoxHeight, self.style.scrollBarBoxMinSize);
            self.page = self.visibleRows.length - 3 - self.attributes.pageUpDownOverlap;
            self.resizeEditInput();
            self.scroll(true);
            if (drawAfterResize) {
                self.draw(true);
            }
            self.dispatchEvent('resize', {});
            return true;
        };
        self.scroll = function (e, dontDraw) {
            var s = self.getVisibleSchema(),
                cellBorder = self.style.cellBorderWidth * 2;
            self.scrollIndexTop = 0;
            self.scrollPixelTop = 0;
            self.scrollIndexLeft = 0;
            self.scrollPixelLeft = 0;
            while (self.scrollPixelTop < self.scrollBox.scrollTop && self.scrollIndexTop < self.data.length) {
                self.scrollPixelTop +=
                    (self.sizes.rows[self.data[self.scrollIndexTop][self.uniqueId]] || self.style.cellHeight)
                    + (self.sizes.trees[self.data[self.scrollIndexTop][self.uniqueId]] || 0)
                    + cellBorder;
                self.scrollIndexTop += 1;
            }
            while (self.scrollPixelLeft < self.scrollBox.scrollLeft && self.scrollIndexLeft < s.length) {
                self.scrollPixelLeft +=
                    (self.sizes.columns[s[self.scrollIndexLeft][self.uniqueId]] || s[self.scrollIndexLeft].width);
                self.scrollIndexLeft += 1;
            }
            if (self.data.length > 0) {
                self.scrollIndexLeft = Math.max(self.scrollIndexLeft - 1, 0);
                self.scrollPixelLeft = Math.max(self.scrollPixelLeft
                    - (self.sizes.columns[s[self.scrollIndexLeft][self.uniqueId]] || s[self.scrollIndexLeft].width), 0);
                self.scrollIndexTop = Math.max(self.scrollIndexTop - 1, 0);
                self.scrollPixelTop = Math.max(self.scrollPixelTop
                    - (self.sizes.rows[self.data[self.scrollIndexTop][self.uniqueId]] || self.style.cellHeight)
                    - (self.sizes.trees[self.data[self.scrollIndexTop][self.uniqueId]] || 0), 0);
            }
            self.ellipsisCache = {};
            if (!dontDraw) {
                self.draw(true);
            }
            //TODO: figure out why this has to be delayed for child grids
            //BUG: wheeling event on 3rd level hierarchy fails to move input box
            requestAnimationFrame(self.resizeEditInput);
            self.dispatchEvent('scroll', {top: self.scrollBox.scrollTop, left: self.scrollBox.scrollLeft});
        };
        self.mousemove = function (e, overridePos) {
            if (self.contextMenu || self.input) {
                return;
            }
            self.mouse = overridePos || self.getLayerPos(e);
            var ctrl = (e.controlKey || e.metaKey || self.attributes.persistantSelectionMode),
                i,
                s = self.getSchema(),
                dragBounds,
                sBounds,
                x = self.mouse.x,
                y = self.mouse.y,
                o = self.getCellAt(x, y),
                delta,
                ev = {NativeEvent: e, cell: o, x: x, y: y},
                previousCell = self.currentCell;
            clearTimeout(self.scrollTimer);
            if (!self.isInGrid({x: x, y: y})) {
                self.hasFocus = false;
            }
            if (self.dispatchEvent('mousemove', ev)) {
                return;
            }
            if (o && self.currentCell && (self.currentCell.rowIndex !== o.rowIndex
                    || self.currentCell.columnIndex !== o.columnIndex)) {
                self.cellBoundaryCrossed = true;
                ev.cell = previousCell;
                self.dispatchEvent('cellmouseout', ev);
                ev.cell = o;
                self.dispatchEvent('cellmouseover', ev);
            }
            self.currentCell = o;
            if (!self.hasFocus) {
                return;
            }
            self.hovers = {};
            if (!self.draggingItem
                    && o
                    && self.scrollModes.indexOf(o.context) === -1) {
                self.dragItem = o;
                self.dragMode = o.dragContext;
                self.canvas.style.cursor = o.context;
                if (o.context === 'cell' && o.data) {
                    self.canvas.style.cursor = 'pointer';
                    self.hovers[o.data[self.uniqueId]] = [o.columnIndex];
                }
                if ((self.selecting || self.reorderObject)
                        && o.context === 'cell'
                        && o.data) {
                    sBounds = self.getSelectionBounds();
                    delta = {
                        x: Math.abs(self.dragStart.x - x),
                        y: Math.abs(self.dragStart.y - y)
                    };
                    if (self.dragStartObject.columnIndex !== -1 && e.shiftKey) {
                        self.dragStartObject = {
                            rowIndex: self.activeCell.rowIndex,
                            columnIndex: self.activeCell.columnIndex
                        };
                    }
                    dragBounds = {
                        top: Math.min(self.dragStartObject.rowIndex, o.rowIndex),
                        left: Math.min(self.dragStartObject.columnIndex, o.columnIndex),
                        bottom: Math.max(self.dragStartObject.rowIndex, o.rowIndex),
                        right: Math.max(self.dragStartObject.columnIndex, o.columnIndex)
                    };
                    if (self.dragStartObject.columnIndex === -1) {
                        dragBounds.left = -1;
                        dragBounds.right = s.length - 1;
                        dragBounds.top = Math.min(sBounds.top, o.rowIndex);
                        dragBounds.bottom = Math.max(sBounds.bottom, o.rowIndex);
                    }
                    if (self.dragStartObject.rowIndex !== o.rowIndex
                                || self.dragStartObject.columnIndex !== o.columnIndex) {
                        self.ignoreNextClick = true;
                    }
                    if (self.cellBoundaryCrossed || (delta.x === 0 && delta.y === 0) || (self.attributes.selectionMode === 'row')) {
                        if ((self.attributes.selectionMode === 'row') || self.dragStartObject.columnIndex === -1) {
                            self.selectRow(o.rowIndex, ctrl, null, true);
                        } else {
                            if (!self.dragAddToSelection && o.rowIndex !== undefined) {
                                if (self.selections[o.rowIndex] && self.selections[o.rowIndex].indexOf(o.columnIndex) !== -1) {
                                    self.selections[o.rowIndex].splice(self.selections[o.rowIndex].indexOf(o.columnIndex), 1);
                                }
                            } else {
                                self.selections[o.rowIndex] = self.selections[o.rowIndex] || [];
                                if (self.selections[o.rowIndex].indexOf(o.columnIndex) === -1) {
                                    self.selections[o.rowIndex].push(o.columnIndex);
                                }
                            }
                        }
                    }
                    if ((!self.selectionBounds || (dragBounds.top !== self.selectionBounds.top
                            || dragBounds.left !== self.selectionBounds.left
                            || dragBounds.bottom !== self.selectionBounds.bottom
                            || dragBounds.right !== self.selectionBounds.right)) && !ctrl) {
                        self.selections = [];
                        sBounds = dragBounds;
                        if (self.attributes.selectionMode === 'row') {
                            for (i = sBounds.top; i <= sBounds.bottom; i += 1) {
                                self.selectRow(i, true, null, true);
                            }
                        } else {
                            self.selectArea(sBounds, true);
                        }
                    }
                    self.autoScrollZone(e, x, y, ctrl);
                }
            }
            self.cellBoundaryCrossed = false;
            self.draw(true);
        };
        self.click = function (e, overridePos) {
            var i,
                selectionChanged,
                ctrl = (e.controlKey || e.metaKey || self.attributes.persistantSelectionMode),
                pos = overridePos || self.getLayerPos(e);
            self.currentCell = self.getCellAt(pos.x, pos.y);
            if (self.currentCell.grid !== undefined) {
                return;
            }
            function checkSelectionChange() {
                if (!selectionChanged) { return; }
                self.dispatchEvent('selectionchanged', {
                    selectedData: self.getSelectedData(),
                    selections: self.selections,
                    selectionBounds: self.selectionBounds
                });
            }
            if (self.input) {
                self.endEdit();
            }
            if (self.ignoreNextClick) {
                self.ignoreNextClick = false;
                return;
            }
            i = self.currentCell;
            if (self.dispatchEvent('click', {NativeEvent: e, cell: self.currentCell})) { return; }
            if (!self.hasFocus) {
                return;
            }
            if (self.currentCell.context === 'cell') {
                if (self.currentCell.style === 'cornerCell') {
                    self.selectAll();
                    self.draw();
                    checkSelectionChange();
                    return;
                }
                if (self.currentCell.style === 'columnHeaderCell') {
                    if (self.attributes.columnHeaderClickBehavior === 'sort') {
                        if (self.orderBy === i.header.name) {
                            self.orderDirection = self.orderDirection === 'asc' ? 'desc' : 'asc';
                        } else {
                            self.orderDirection = 'asc';
                        }
                        self.order(i.header.name, self.orderDirection);
                        checkSelectionChange();
                        return;
                    }
                    if (self.attributes.columnHeaderClickBehavior === 'select') {
                        self.selectColumn(i.header.index, ctrl, e.shiftKey, true);
                        checkSelectionChange();
                        self.draw();
                        return;
                    }
                }
                if (['rowHeaderCell', 'columnHeaderCell'].indexOf(self.currentCell.style) === -1 && !ctrl) {
                    self.setActiveCell(i.columnIndex, i.rowIndex);
                }
                self.selections[i.rowIndex] = self.selections[i.rowIndex] || [];
                if (((self.attributes.selectionMode === 'row') || self.currentCell.style === 'rowHeaderCell')) {
                    if (self.currentCell.style === 'rowHeaderCell'
                            && self.attributes.tree && pos.x > 0
                            && pos.x - self.currentCell.x < self.style.treeArrowWidth
                            + self.style.treeArrowMarginLeft
                            + self.style.treeArrowMarginRight + self.style.treeArrowClickRadius
                            && pos.y - self.currentCell.y < self.style.treeArrowHeight
                            + self.style.treeArrowMarginTop + self.style.treeArrowClickRadius
                            && pos.y > 0) {
                        self.toggleTree(i.rowIndex);
                        return;
                    }
                    selectionChanged = true;
                    self.selectRow(i.rowIndex, ctrl, null, true);
                }
                if (e.shiftKey && !ctrl) {
                    self.selectionBounds = self.getSelectionBounds();
                    self.selectArea(undefined, false);
                }
            }
            checkSelectionChange();
            self.draw(true);
        };
        self.dragResizeColumn = function (e) {
            var pos, x, y;
            pos = self.getLayerPos(e);
            x = self.resizingStartingWidth + pos.x - self.dragStart.x;
            y = self.resizingStartingHeight + pos.y - self.dragStart.y;
            if (x < self.style.minColumnWidth) {
                x = self.style.minColumnWidth;
            }
            if (y < self.style.minRowHeight) {
                y = self.style.minRowHeight;
            }
            if (self.dispatchEvent('resizecolumn', {x: x, y: y, draggingItem: self.draggingItem})) { return false; }
            if (self.scrollBox.scrollLeft > self.scrollBox.scrollWidth - self.attributes.resizeScrollZone
                    && self.dragMode === 'ew-resize') {
                self.resize(true);
                self.scrollBox.scrollLeft += x;
            }
            if (self.dragMode === 'ew-resize') {
                self.sizes.columns[self.draggingItem.header.style === 'rowHeaderCell'
                       ? 'cornerCell' : self.draggingItem.header[self.uniqueId]] = x;
                if (['rowHeaderCell', 'cornerCell'].indexOf(self.draggingItem.header.style) !== -1) {
                    self.resize(true);
                }
                self.resizeChildGrids();
                return;
            }
            if (self.dragMode === 'ns-resize') {
                if (self.draggingItem.rowOpen) {
                    self.sizes.trees[self.draggingItem.data[self.uniqueId]] = y;
                } else if (self.attributes.globalRowResize) {
                    self.style.cellHeight = y;
                } else {
                    self.sizes.rows[self.draggingItem.data[self.uniqueId]] = y;
                }
                self.dispatchEvent('resizerow', {row: y});
                self.resizeChildGrids();
                return;
            }
            self.ellipsisCache = {};
        };
        self.stopDragResize = function () {
            self.resize();
            document.body.removeEventListener('mousemove', self.dragResizeColumn, false);
            document.body.removeEventListener('mouseup', self.stopDragResize, false);
            self.setStorageData();
            self.draw(true);
            self.ignoreNextClick = true;
        };
        self.scrollGrid = function (e) {
            var pos = self.getLayerPos(e);
            if (self.attributes.scrollPointerLock && self.pointerLockPosition
                    && ['horizontal-scroll-box', 'vertical-scroll-box'].indexOf(self.scrollStartMode) !== -1) {
                self.pointerLockPosition.x += e.movementX;
                self.pointerLockPosition.y += e.movementY;
                self.pointerLockPosition.x = Math.min(self.width - self.style.scrollBarWidth, Math.max(0, self.pointerLockPosition.x));
                self.pointerLockPosition.y = Math.min(self.height - self.style.scrollBarWidth, Math.max(0, self.pointerLockPosition.y));
                pos = self.pointerLockPosition;
            }
            self.scrollMode = self.getCellAt(pos.x, pos.y).context;
            if (self.scrollMode === 'horizontal-scroll-box' && self.scrollStartMode !== 'horizontal-scroll-box') {
                self.scrollStartMode = 'horizontal-scroll-box';
                self.dragStart = pos;
                self.scrollStart.left = self.scrollBox.scrollLeft;
                clearTimeout(self.scrollTimer);
                return;
            }
            if (self.scrollMode === 'vertical-scroll-box' && self.scrollStartMode !== 'vertical-scroll-box') {
                self.scrollStartMode = 'vertical-scroll-box';
                self.dragStart = pos;
                self.scrollStart.top = self.scrollBox.scrollTop;
                clearTimeout(self.scrollTimer);
                return;
            }
            if (self.scrollStartMode === 'vertical-scroll-box'
                    && self.scrollMode !== 'vertical-scroll-box') {
                self.scrollMode = 'vertical-scroll-box';
            }
            if (self.scrollStartMode === 'horizontal-scroll-box'
                    && self.scrollMode !== 'horizontal-scroll-box') {
                self.scrollMode = 'horizontal-scroll-box';
            }
            clearTimeout(self.scrollTimer);
            if (self.scrollModes.indexOf(self.scrollMode) === -1) {
                return;
            }
            if (self.scrollMode === 'vertical-scroll-box') {
                self.scrollBox.scrollTop = self.scrollStart.top + ((pos.y - self.dragStart.y)
                    / self.scrollBox.heightBoxRatio);
            } else if (self.scrollMode === 'vertical-scroll-top') {
                self.scrollBox.scrollTop -= (self.page * self.style.cellHeight);
                self.scrollTimer = setTimeout(self.scrollGrid, self.attributes.scrollRepeatRate, e);
            } else if (self.scrollMode === 'vertical-scroll-bottom') {
                self.scrollBox.scrollTop += (self.page * self.style.cellHeight);
                self.scrollTimer = setTimeout(self.scrollGrid, self.attributes.scrollRepeatRate, e);
            }
            if (self.scrollMode === 'horizontal-scroll-box') {
                self.scrollBox.scrollLeft = self.scrollStart.left + ((pos.x - self.dragStart.x)
                    / self.scrollBox.widthBoxRatio);
            } else if (self.scrollMode === 'horizontal-scroll-right') {
                self.scrollBox.scrollLeft += self.attributes.selectionScrollIncrement;
                self.scrollTimer = setTimeout(self.scrollGrid, self.attributes.scrollRepeatRate, e);
            } else if (self.scrollMode === 'horizontal-scroll-left') {
                self.scrollBox.scrollLeft -= self.attributes.selectionScrollIncrement;
                self.scrollTimer = setTimeout(self.scrollGrid, self.attributes.scrollRepeatRate, e);
            }
        };
        self.stopScrollGrid = function () {
            clearTimeout(self.scrollTimer);
            if (document.exitPointerLock) {
                document.exitPointerLock();
            }
            document.body.removeEventListener('mousemove', self.scrollGrid, false);
        };
        self.dragReorder = function (e) {
            var pos, x, y;
            pos = self.getLayerPos(e);
            x = pos.x - self.dragStart.x;
            y = pos.y - self.dragStart.y;
            if (!self.attributes.allowColumnReordering && self.dragMode === 'column-reorder') {
                return;
            }
            if (!self.attributes.allowRowReordering && self.dragMode === 'row-reorder') {
                return;
            }
            if (self.dispatchEvent('reordering', {
                    NativeEvent: e,
                    source: self.dragStartObject,
                    target: self.currentCell,
                    dragMode: self.dragMode
                })) {
                return;
            }
            if (Math.abs(x) > self.attributes.reorderDeadZone || Math.abs(y) > self.attributes.reorderDeadZone) {
                self.reorderObject = self.dragStartObject;
                self.reorderTarget = self.currentCell;
                self.reorderObject.dragOffset = {
                    x: x,
                    y: y
                };
                self.autoScrollZone(e, pos.x, pos.x, false);
            }
        };
        self.stopDragReorder = function (e) {
            var cr = {
                    'row-reorder': self.orders.rows,
                    'column-reorder': self.orders.columns
                },
                i = {
                    'row-reorder': 'rowIndex',
                    'column-reorder': 'columnIndex'
                }[self.dragMode];
            document.body.removeEventListener('mousemove', self.dragReorder, false);
            document.body.removeEventListener('mouseup', self.stopDragReorder, false);
            if (self.reorderObject
                    && self.reorderTarget) {
                self.ignoreNextClick = true;
                if (self.reorderObject[i] !== self.reorderTarget[i]
                        && !self.dispatchEvent('reorder', {
                            NativeEvent: e,
                            source: self.reorderObject,
                            target: self.reorderTarget,
                            dragMode: self.dragMode
                        })) {
                    cr[self.dragMode].splice(cr[self.dragMode].indexOf(self.reorderObject[i]), 1);
                    cr[self.dragMode].splice(cr[self.dragMode].indexOf(self.reorderTarget[i]), 0, self.reorderObject[i]);
                    self.setStorageData();
                }
            }
            self.reorderObject = undefined;
            self.reorderTarget = undefined;
            self.draw(true);
        };
        self.mousedown = function (e, overridePos) {
            self.lastMouseDownTarget = e.target;
            if (self.dispatchEvent('mousedown', {NativeEvent: e, cell: self.currentCell})) { return; }
            if (!self.hasFocus) {
                return;
            }
            if (e.button === 2 || self.input) { return; }
            var ctrl = (e.controlKey || e.metaKey);
            self.dragStart = overridePos || self.getLayerPos(e);
            self.scrollStart = {
                left: self.scrollBox.scrollLeft,
                top: self.scrollBox.scrollTop
            };
            self.dragStartObject = self.getCellAt(self.dragStart.x, self.dragStart.y);
            self.dragAddToSelection = !self.dragStartObject.selected;
            if (!ctrl && !e.shiftKey && !/(vertical|horizontal)-scroll-(bar|box)/
                    .test(self.dragStartObject.context)
                    && self.currentCell
                    && !self.currentCell.isColumnHeader) {
                self.selections = [];
            }
            if (self.dragStartObject.isGrid) {
                return;
            }
            if (self.scrollModes.indexOf(self.dragStartObject.context) !== -1) {
                self.scrollMode = self.dragStartObject.context;
                self.scrollStartMode = self.dragStartObject.context;
                self.scrollGrid(e);
                if (self.attributes.scrollPointerLock
                        && ['horizontal-scroll-box', 'vertical-scroll-box'].indexOf(self.scrollStartMode) !== -1) {
                    self.pointerLockPosition = {
                        x: self.dragStart.x,
                        y: self.dragStart.y
                    };
                    self.canvas.requestPointerLock();
                }
                document.body.addEventListener('mousemove', self.scrollGrid, false);
                document.body.addEventListener('mouseup', self.stopScrollGrid, false);
                self.ignoreNextClick = true;
                return;
            }
            if (self.dragMode === 'cell') {
                self.selecting = true;
                if (self.attributes.selectionMode === 'row') {
                    self.selectRow(self.dragStartObject.rowIndex, ctrl, null, true);
                }
                return self.mousemove(e);
            }
            if (['ns-resize', 'ew-resize'].indexOf(self.dragMode) !== -1) {
                self.draggingItem = self.dragItem;
                if (self.draggingItem.rowOpen) {
                    self.resizingStartingHeight = self.sizes.trees[self.draggingItem.data[self.uniqueId]];
                } else {
                    self.resizingStartingHeight = self.sizes.rows[self.draggingItem.data[self.uniqueId]] || self.style.cellHeight;
                }
                self.resizingStartingWidth = self.sizes.columns[self.draggingItem.header.style === 'rowHeaderCell'
                       ? 'cornerCell' : self.draggingItem.header[self.uniqueId]] || self.draggingItem.width;
                document.body.addEventListener('mousemove', self.dragResizeColumn, false);
                document.body.addEventListener('mouseup', self.stopDragResize, false);
            }
            if (['row-reorder', 'column-reorder'].indexOf(self.dragMode) !== -1) {
                self.draggingItem = self.dragItem;
                document.body.addEventListener('mousemove', self.dragReorder, false);
                document.body.addEventListener('mouseup', self.stopDragReorder, false);
            }
        };
        self.mouseup = function (e) {
            clearTimeout(self.scrollTimer);
            self.cellBoundaryCrossed = true;
            self.selecting = undefined;
            self.draggingItem = undefined;
            self.dragStartObject = undefined;
            if (self.dispatchEvent('mouseup', {NativeEvent: e, cell: self.currentCell})) { return; }
            if (!self.hasFocus && e.target !== self.canvas) {
                return;
            }
            if (self.currentCell && self.currentCell.grid !== undefined) {
                return;
            }
            if (self.contextMenu || self.input) { return; }
            if (self.dragStart && self.isInGrid(self.dragStart)) {
                self.controlInput.focus();
            }
            e.preventDefault();
        };
        self.keydown = function (e) {
            var i,
                x = self.activeCell.columnIndex,
                y = self.activeCell.rowIndex,
                ctrl = (e.controlKey || e.metaKey),
                last = self.data.length - 1,
                cols = self.getVisibleSchema().length - 1;
            if (self.dispatchEvent('keydown', {NativeEvent: e, cell: self.currentCell})) { return; }
            if (!self.hasFocus) {
                return;
            }
            self.page = self.visibleRows.length - 3 - self.attributes.pageUpDownOverlap;
            if (self.attributes.showNewRow) {
                last += 1;
            }
            if (e.keyCode === 9) {
                e.preventDefault();
            }
            // esc
            if (e.keyCode === 27) {
                self.selections = [];
                self.draw(true);
            // ctrl + a
            } else if (ctrl && e.keyCode === 65) {
                self.selectAll();
            //ArrowDown
            } else if (e.keyCode === 40) {
                y += 1;
            //ArrowUp
            } else if (e.keyCode === 38) {
                y -= 1;
            //ArrowLeft Tab
            } else if (e.keyCode === 37 || (e.shiftKey && e.keyCode === 9)) {
                x -= 1;
            //ArrowRight Tab
            } else if (e.keyCode === 39 || (!e.shiftKey && e.keyCode === 9)) {
                x += 1;
            //PageUp
            } else if (e.keyCode === 33) {
                y -= self.page;
                e.preventDefault();
            //PageDown
            } else if (e.keyCode === 34) {
                y += self.page;
                e.preventDefault();
            //Home ArrowUp
            } else if (e.keyCode === 36 || (ctrl && e.keyCode === 38)) {
                y = 0;
            //End ArrowDown
            } else if (e.keyCode === 35 || (ctrl && e.keyCode === 40)) {
                y = self.data.length - 1;
            //ArrowRight
            } else if (ctrl && e.keyCode === 39) {
                x = cols;
            //ArrowLeft
            } else if (ctrl && e.keyCode === 37) {
                x = 0;
            }
            //Enter
            if (e.keyCode === 13) {
                return self.beginEditAt(x, y);
            }
            //Space
            if (e.keyCode === 32) {
                self.selections = [];
                self.selections[Math.max(y, 0)] = [];
                self.selections[Math.max(y, 0)].push(x);
                self.selectionBounds = self.getSelectionBounds();
                if (self.attributes.selectionMode === 'row') {
                    for (i = self.selectionBounds.top; i <= self.selectionBounds.bottom; i += 1) {
                        self.selectRow(i, ctrl, null, true);
                    }
                } else {
                    self.selectArea(undefined, ctrl);
                }
                e.preventDefault();
                self.draw(true);
                return;
            }
            if (x < 0) {
                x = 0;
            }
            if (y > last) {
                y = last;
            }
            if (y < 0) {
                y = 0;
            }
            if (x > cols) {
                x = cols;
            }
            // Arrows
            if (e.shiftKey && [37, 38, 39, 40].indexOf(e.keyCode) !== -1) {
                self.selections[Math.max(y, 0)] = self.selections[Math.max(y, 0)] || [];
                self.selections[Math.max(y, 0)].push(x);
                self.selectionBounds = self.getSelectionBounds();
                self.selectArea(undefined, ctrl);
                self.draw(true);
            }
            if (x !== self.activeCell.columnIndex || y !== self.activeCell.rowIndex) {
                self.scrollIntoView(x !== self.activeCell.columnIndex ? x : undefined, y !== self.activeCell.rowIndex ? y : undefined);
                self.setActiveCell(x, y);
                if (!e.shiftKey && self.attributes.selectionFollowsActiveCell) {
                    if (!ctrl) {
                        self.selections = [];
                    }
                    self.selections[y] = self.selections[y] || [];
                    self.selections[y].push(x);
                    self.dispatchEvent('selectionchanged', {
                        selectedData: self.getSelectedData(),
                        selections: self.selections,
                        selectionBounds: self.selectionBounds
                    });
                }
                self.draw(true);
            }
        };
        self.keyup = function (e) {
            if (self.dispatchEvent('keyup', {NativeEvent: e, cell: self.currentCell})) { return; }
            if (!self.hasFocus) {
                return;
            }
            self.controlInput.value = '';
        };
        self.keypress = function (e) {
            if (!self.hasFocus) {
                return;
            }
            if (self.dispatchEvent('keypress', {NativeEvent: e, cell: self.currentCell})) { return; }
        };
        self.dblclick = function (e) {
            if (self.dispatchEvent('dblclick', {NativeEvent: e, cell: self.currentCell})) { return; }
            if (!self.hasFocus) {
                return;
            }
            if (self.currentCell.context === 'ew-resize'
                    && self.currentCell.style === 'columnHeaderCell') {
                self.fitColumnToValues(self.currentCell.header.name);
            } else if (self.currentCell.context === 'ew-resize'
                    && self.currentCell.style === 'cornerCell') {
                self.autosize();
            } else if (['cell', 'activeCell'].indexOf(self.currentCell.style) !== -1) {
                self.beginEditAt(self.currentCell.columnIndex, self.currentCell.rowIndex);
            }
        };
        self.scrollWheel = function (e) {
            var l,
                t,
                deltaX = e.deltaX === undefined ? e.NativeEvent.deltaX : e.deltaX,
                deltaY = e.deltaY === undefined ? e.NativeEvent.deltaY : e.deltaY,
                deltaMode = e.deltaMode === undefined ? e.NativeEvent.deltaMode : e.deltaMode;
            if (wheeling) {
                return;
            }
            wheeling = setTimeout(function () {
                if (self.dispatchEvent('wheel', {NativeEvent: e})) {
                    return;
                }
                e = e.NativeEvent || e;
                self.touchHaltAnimation = true;
                l = self.scrollBox.scrollLeft;
                t = self.scrollBox.scrollTop;
                if (self.hasFocus) {
                    //BUG Issue 42: https://github.com/TonyGermaneri/canvas-datagrid/issues/42
                    //https://stackoverflow.com/questions/20110224/what-is-the-height-of-a-line-in-a-wheel-event-deltamode-dom-delta-line
                    if (deltaMode === 1) {
                        // line mode = 17 pixels per line
                        deltaY = deltaY * 17;
                    }
                    self.scrollBox.scrollTo(deltaX + l, deltaY + t);
                }
                if (t !== self.scrollBox.scrollTop || l !== self.scrollBox.scrollLeft) {
                    e.preventDefault();
                }
                wheeling = undefined;
            }, 1);
        };
        self.copy = function (e) {
            if (self.dispatchEvent('copy', {NativeEvent: e})) { return; }
            if (!self.hasFocus || !e.clipboardData) { return; }
            var rows = [], sData = self.getSelectedData();
            if (sData.length > 0) {
                sData.forEach(function (row) {
                    if (row) {
                        var r = [];
                        Object.keys(row).forEach(function (key) {
                            if (row[key] !== null
                                    && row[key] !== false
                                    && row[key] !== undefined
                                    && row[key].replace) {
                                return r.push('"' + row[key].replace(/"/g, '""') + '"');
                            }
                            r.push(row[key]);
                        });
                        r.join(',');
                        rows.push(r);
                    }
                });
                e.clipboardData.setData('text/plain', rows.join('\n'));
                e.preventDefault();
            }
        };
        return;
    };
});
