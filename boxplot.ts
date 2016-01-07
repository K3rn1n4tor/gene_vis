/**
 * Created by Michael Kern on 16.12.2015.
 */

/* global defines */
'use strict';

import d3 = require('d3');
import vis = require('../caleydo_core/vis');
import vector = require('../caleydo_core/vector');

import geom = require('../caleydo_core/geom');
import range = require('../caleydo_core/range');
import C = require('../caleydo_core/main');

export class BoxPlot extends vis.AVisInstance implements vis.IVisInstance
{
  private $node : d3.Selection<any>;

  constructor(public data: vector.IVector, public parent: Element, private options: any)
  {
    super();

    this.options = C.mixin({
      scale: [1, 1],
      rotate: 0}, options);

    this.$node = this.build(d3.select(parent));
    this.$node.datum(data);
    vis.assignVis(<Element>this.$node.node(), this);
  }

  get rawSize(): [number, number]
  {
    return [150,300];
  }

  get node()
  {
    return <Element>this.$node.node();
  }

  option(name: string, val? : any)
  {
    if (arguments.length === 1)
    {
      return this.options[name];
    }
    else
    {
      this.fire('option', name, val, this.options[name]);
      this.fire('option.'+name, val, this.options[name]);
      this.options[name] = val;
      //handle option change
    }
  }

  locateImpl(range: range.Range)
  {
    var rawSize = this.rawSize;
    var size = this.size;
    var o = this.options;

    return Promise.resolve(geom.rect(0, 0, size[0], size[1]));
  }

  transform(scale?: number[], rotate: number = 0)
  {
    var opts =
    {
      scale: this.options.scale || [1, 1],
      rotate: this.options.rotate || 0
    };
    // default way to check how many arguments were passed into the function
    if (arguments.length == 0) { return opts; }

    // get raw size of image
    var raw = this.rawSize;
    this.$node.style('transform', 'rotate(' + rotate + 'deg)');
    this.$node.attr('width', raw[0] * scale[0]).attr('height', raw[1] * scale[1]);
    this.$node.select('g').attr('transform', 'scale(' + scale[0] + ',' + scale[1] + ')');

    var newSize =
    {
      scale: scale,
      rotate: rotate
    };

    // fire new event with transform signal
    this.fire('transform', newSize, opts);
    // set new values for options
    this.options.scale = scale;
    this.options.rotate = rotate;
    return newSize;
  }

  private median(data: number[]) : number
  {
    var n = data.length;
    var middle = Math.floor(n / 2.0);

    if (n % 2 === 0)
    {
      var prev = middle - 1;
      return (data[middle] + data[prev]) / 2.0;
    }
    else
    {
      return data[middle];
    }
  }

  updateGraph(data: vector.IVector)
  {
    d3.select('.box_plot').remove();

    this.data = data;
    this.$node = this.build(d3.select(this.parent));
    this.$node.datum(data);
    vis.assignVis(<Element>this.$node.node(), this);
  }

  private build($parent: d3.Selection<any>)
  {
    var scaling = this.options.scale;
    var size = this.size;
    var rawSize = this.rawSize;

    var $svg = $parent.append('svg').attr({
      width: size[0],
      height: size[1],
      'class': 'box_plot'
    });

    var $root = $svg.append('g').attr('transform', 'scale(' + scaling[0] + ',' + scaling[1] + ')');

    this.data.data().then( (vec) =>
    {
      // first sort the data
      var sortedVec = vec.sort(d3.ascending);

      // compute all required information
      var q25 = d3.quantile(sortedVec, 0.25);
      var q75 = d3.quantile(sortedVec, 0.75);
      var iqr = q75 - q25;
      var iqr15 = 1.5 * iqr;
      var iqr30 = 3.0 * iqr;

      var median = this.median(sortedVec);
      var mean = d3.mean(sortedVec);
      var min = sortedVec[0];
      var max = sortedVec[sortedVec.length - 1];

      // compute borders for boxes using the iqr rules
      var q15MinMax = [median - iqr15, median + iqr15];
      var q30MinMax = [median - iqr30, median + iqr30];

      // collect outliers
      var outliersInnerFence = [];
      var outliersInnerFenceHigh = [];
      var outliers = [];
      var outliersHigh = [];
      var iqrMinMax = [0, 0];

      // search for outliers in the region below the median
      for (var i = Math.floor(sortedVec.length / 2.0); i >= 0; --i)
      {
        var value = sortedVec[i];
        // get value nearest to interquantile range x 1.5
        if (value >= q15MinMax[0])
        {
          iqrMinMax[0] = value;
        }
        // collect all inner fence outliers
        if (value < q15MinMax[0] && value >= q30MinMax[0])
        {
          outliersInnerFence.push(value);
        }
        // collect all outer fence outliers
        if (value < q30MinMax[0])
        {
          outliers.push(value);
        }
      }

      // search for outliers in the region above the median
      for (var i = Math.floor(sortedVec.length / 2.0); i < sortedVec.length; ++i)
      {
        var value = sortedVec[i];
        // get value nearest to interquantile range x 1.5
        if (value <= q15MinMax[1])
        {
          iqrMinMax[1] = value;
        }
        // collect all inner fence outliers
        if (value > q15MinMax[1] && value <= q30MinMax[1])
        {
          outliersInnerFence.push(value);
        }
        // collect all outer fence outliers
        if (value > q30MinMax[1])
        {
          outliers.push(value);
        }
      }

      // create scales
      var yScale = d3.scale.linear().domain([min, max]).range([rawSize[1], 0]).nice();
      var boxWidth = rawSize[0] * 0.9;
      var boxWidthHalf = boxWidth / 2.0;
      var offset = rawSize[0] * 0.05;

      var xCoords = [offset, offset + boxWidth];
      var xScale = d3.scale.linear().domain([0, 1]).range(xCoords);


      var diffQ = Math.min(yScale(median) - yScale(q75), yScale(q25) - yScale(median));
      var notchOffsetPerc = 0.25;
      var notchOffset = diffQ * notchOffsetPerc;
      var notchCoords = [xScale(0) + notchOffset, xScale(1) - notchOffset];
      //console.log(notchOffset);

      // draw median line
      var lineMedian = $root.append('line').attr({
        x1: notchCoords[0], y1: yScale(median),
        x2: notchCoords[1], y2: yScale(median),
        'class': 'median',
        'stroke': 'black',
        'stroke-width': '2px'
      });

      var upperNotchY = [yScale(q75), yScale(median)];
      var lowerNotchY = [yScale(q25), yScale(median)];

      // set path for box plot notch
      var upperNotchPolyData = [
        { x: xCoords[0], y: upperNotchY[0]},
        { x: xCoords[1], y: upperNotchY[0]},
        { x: xCoords[1], y: upperNotchY[1] - notchOffset},
        { x: notchCoords[1], y: upperNotchY[1]},
        { x: notchCoords[0], y: upperNotchY[1]},
        { x: xCoords[0], y: upperNotchY[1] - notchOffset}];

      var lowerNotchPolyData = [
        { x: xCoords[0], y: lowerNotchY[0]},
        { x: xCoords[1], y: lowerNotchY[0]},
        { x: xCoords[1], y: lowerNotchY[1] + notchOffset},
        { x: notchCoords[1], y: lowerNotchY[1]},
        { x: notchCoords[0], y: lowerNotchY[1]},
        { x: xCoords[0], y: lowerNotchY[1] + notchOffset}];

      var notchPolyFunc = d3.svg.line().x( (d: any) => d['x'] ).y( (d: any) => d['y']);

      // draw notch
      var upperNotch = $root.append('path').attr({
         'class': 'quantile',
        'd': () => { return notchPolyFunc(<any>upperNotchPolyData) + 'Z'; },
        'fill': 'none',
        'stroke': 'black', 'stroke-width': '2px'
      });

      var lowerNotch = $root.append('path').attr({
         'class': 'quantile',
        'd': () => { return notchPolyFunc(<any>lowerNotchPolyData) + 'Z'; },
        'fill': 'none',
        'stroke': 'black', 'stroke-width': '2px'
      });

      // draw interquantile range
      var lineUp = $root.append('line').attr({
        'class': 'iqrLine',
        x1: xScale(0.5),
        y1: upperNotchY[0],
        x2: xScale(0.5),
        y2: yScale(iqrMinMax[1]),
        'fill': 'none',
        'stroke': 'black',
        'stroke-width': '2px'
      });

      var lineDown = $root.append('line').attr({
        'class': 'iqrLine',
        x1: xScale(0.5),
        y1: lowerNotchY[0],
        x2: xScale(0.5),
        y2: yScale(iqrMinMax[0]),
        'fill': 'none',
        'stroke': 'black',
        'stroke-width': '2px'
      });

      // draw wiskers
      var wiskerUp = $root.append('line').attr({
        'class': 'iqrLine',
        x1: xScale(0.4),
        y1: yScale(iqrMinMax[1]),
        x2: xScale(0.6),
        y2: yScale(iqrMinMax[1]),
        'fill': 'none',
        'stroke': 'black',
        'stroke-width': '2px'
      });

      var wiskerDown = $root.append('line').attr({
        'class': 'iqrLine',
        x1: xScale(0.4),
        y1: yScale(iqrMinMax[0]),
        x2: xScale(0.6),
        y2: yScale(iqrMinMax[0]),
        'fill': 'none',
        'stroke': 'black',
        'stroke-width': '2px'
      });

      // draw outliers
      var circlesInnerFence = $root.selectAll('.innerCircles')
        .data(outliersInnerFence).enter()
        .append('circle').attr({
          cx: xScale(0.5),
          cy: (d: any) => yScale(d),
          r: xScale(0.005),
          'fill': 'none',
          'stroke': 'black',
          'stroke-width': '1px'
        });

      var circlesOuterFence = $root.selectAll('.outerCircles')
        .data(outliers).enter()
        .append('circle').attr({
          cx: xScale(0.5),
          cy: (d: any) => yScale(d),
          r: xScale(0.005),
          'fill': 'black',
          'stroke': 'black',
          'stroke-width': '1px'
        });


      this.markReady();
    });

    return $svg;
  }
}

export function create(data: vector.IVector, parent: Element, options: any) : vis.AVisInstance
{
  return new BoxPlot(data, parent, options);
}
