/**
 * Created by Samuel Gratzl on 05.08.2014.
 */
/// <reference path="../../tsd.d.ts" />
//depend on a css dependency
/// <amd-dependency path='css!./style' />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", 'd3', '../caleydo_core/vis', '../caleydo_core/geom', '../caleydo_core/main', "css!./style"], function (require, exports, d3, vis, geom, C) {
    'use strict';
    // define new class, use export to make it accessible outside of this file
    var LineGraph = (function (_super) {
        __extends(LineGraph, _super);
        // implement constructor, access varname : type
        function LineGraph(data, parent, options) {
            // invoke super constructor
            _super.call(this);
            this.data = data;
            this.parent = parent;
            this.options = options;
            // mix options into default options
            this.options = C.mixin({
                scale: [4, 2],
                rotate: 0 }, options);
            // invoke build method to create svg element
            this.$parent = parent;
            this.$node = this.build(d3.select(parent));
            // assign data to svg element
            this.$node.datum(data);
            // ? maybe register new vis
            vis.assignVis(this.$node.node(), this);
        }
        Object.defineProperty(LineGraph.prototype, "rawSize", {
            /**
             * the raw size without any scaling factors applied
             * @returns {any[])
             */
            get: function () {
                var d = this.data.dim;
                return [d[0], 100];
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LineGraph.prototype, "node", {
            /**
             * returns the HTML element of this visualization
             * @return {Element}
             */
            get: function () {
                return this.$node.node();
            },
            enumerable: true,
            configurable: true
        });
        /**
         * get/set an option of this vis
         * @param name
         * @param val
         * @returns {any}
         */
        LineGraph.prototype.option = function (name, val) {
            if (arguments.length === 1) {
                return this.options[name];
            }
            else {
                this.fire('option', name, val, this.options[name]);
                this.fire('option.' + name, val, this.options[name]);
                this.options[name] = val;
            }
        };
        /**
         * locate a range of items and returning their geometric position
         * @param range
         * @returns {IPromise<any>}
         */
        LineGraph.prototype.locateImpl = function (range) {
            var dims = this.data.dim;
            var maxY = dims[0];
            var o = this.options;
            console.log('invoked line_graph.locateImpl method');
            // TODO: understand and implement locating
            return this.data.data(range).then(function (data) {
                // TODO return geometric position
                console.log(data);
                return geom.rect(0, 0, dims[0], dims[1]);
            });
        };
        /**
         * transforms this visualization given the scaling and rotation factor
         * @param scale
         * @param rotate
         * @returns {any}
           */
        LineGraph.prototype.transform = function (scale, rotate) {
            if (rotate === void 0) { rotate = 0; }
            var opts = {
                scale: this.options.scale || [1, 1],
                rotate: this.options.rotate || 0
            };
            // default way to check how many arguments were passed into the function
            if (arguments.length == 0) {
                return opts;
            }
            // get raw size of image
            var raw = this.rawSize;
            this.$node.style('transform', 'rotate(' + rotate + 'deg)');
            this.$node.attr('width', raw[0] * scale[0]).attr('height', raw[1] * scale[1]);
            this.$node.select('g').attr('transform', 'scale(' + scale[0] + ',' + scale[1] + ')');
            var newSize = {
                scale: scale,
                rotate: rotate
            };
            // fire new event with transform signal
            this.fire('transform', newSize, opts);
            // set new values for options
            this.options.scale = scale;
            this.options.rotate = rotate;
            return newSize;
        };
        /**
         *
         * @param data
           */
        LineGraph.prototype.updateGraph = function (data) {
            console.log('update linechart');
            // destroy svg element
            d3.select('.line_graph').remove();
            // assign new  data to svg element
            this.data = data;
            this.$node = this.build(d3.select(this.$parent));
            this.$node.datum(data);
            vis.assignVis(this.$node.node(), this);
        };
        /**
         *
         * @param $parent
         * @returns {Selection<any>}
           */
        LineGraph.prototype.build = function ($parent) {
            var _this = this;
            // gather all required info
            var scaleFactor = this.options.scale;
            var size = this.size;
            var rawSize = this.rawSize;
            // create an ew svg element
            var $svg = $parent.append('svg').attr({
                width: size[0],
                height: size[1],
                'class': 'line_graph' // assign it a class name
            });
            // set group element as root (needed for transformation)
            var $root = $svg.append('g').attr('transform', 'scale(' + scaleFactor[0] + ',' + scaleFactor[1] + ')');
            // obtain data from vis and create vis elements
            this.data.data().then(function (vec) {
                console.log("line_graph.build is invoked");
                console.log(size);
                // set scales
                var $xScale = d3.scale.linear().domain([0, _this.data.dim[0]]).range([0, rawSize[0]]);
                var $yScale = d3.scale.linear().domain(d3.extent(vec)).range([rawSize[1], 0]);
                console.log('vector extent = ' + d3.extent(vec).toString());
                //var test = [];
                // test
                //vec.forEach( (v) => { test.push({ 'val': v }); });
                // compute lines
                var $lineFunction = d3.svg.line()
                    .x(function (d, i) { return $xScale(i); })
                    .y(function (d) { return $yScale(d); })
                    .interpolate('linear');
                // create path element
                $root.append('line')
                    .attr({ 'x1': 0, 'y1': $yScale(0),
                    'x2': size[0], 'y2': $yScale(0),
                    'class': 'zeroLine'
                });
                $root.append('path').datum(vec)
                    .attr({ 'class': 'line',
                    'd': $lineFunction,
                    'fill': 'none' });
                _this.markReady();
            });
            return $svg;
        };
        return LineGraph;
    })(vis.AVisInstance);
    exports.LineGraph = LineGraph;
    // export create function to create a new LineGraph instance
    function create(data, parent, options) {
        return new LineGraph(data, parent, options);
    }
    exports.create = create;
});
//# sourceMappingURL=linechart.js.map