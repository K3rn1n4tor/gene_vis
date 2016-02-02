/**
 * Created by Michael Kern on 29.01.2016
 */

'use strict';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// libraries
import d3 = require('d3')
import C = require('../caleydo_core/main');
import vis = require('../caleydo_core/vis');

import vector = require('../caleydo_core/vector');
import matrix = require('../caleydo_core/matrix');
import strati = require('../caleydo_core/stratification_impl');
import geom = require('../caleydo_core/geom');
import ranges = require('../caleydo_core/range');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// solarized colors
// see --> http://ethanschoonover.com/solarized

var red = '#dc322f';
var yellow = '#b58900';
var orange = '#cb4b16';
var green = '#859900';
var cyan = '#2aa198';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class declaration

/**
 *
 */
export class ClusterDivider extends vis.AVisInstance implements vis.IVisInstance
{
  private $node: d3.Selection<any>;
  private divisions: number[] = [];
  private bars: any[];
  private sliders: d3.Selection<any>[] = [];
  private changed: boolean = false;

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param histoData
   * @param labels
   * @param data
   * @param parent
   * @param options
     */
  constructor(public histoData: any, public labels: number[],
              public data: any, public parent: Element, private options: any)
  {
    super();
    this.options = C.mixin(
      {
        scale: [1, 1], // scaling of the svg element
        rotate: 0, // rotation degree
        bins: 20, // number of bins
        padding: 8, // padding between each histogram bar <-> width of slider
        barColor: '#334433', // default color of bars
        barOffsetRatio: 0.05, // vertical offset of histogram bars
        sliderStarts: [1, 3], // start indices of the sliders
        numSlider: 2, // number of sliders
        sliderColor: 'grey', // color of the sliders
        animationTime: 50 // animation time duration
      }, options);

    if (this.options.scaleTo)
    {
      var scaling = this.options.scaleTo;
      var raw = this.rawSize;
      this.options.scale = raw.map((d, i) => { return scaling[i] / d });
    }

    this.$node = this.build(d3.select(this.parent));
    this.$node.datum(histoData);
    vis.assignVis(<Element>this.$node.node(), this);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @returns {number[]}
     */
  get rawSize(): [number, number]
  {
    return [300, 50];
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @returns {Element}
     */
  get node()
  {
    return <Element>this.$node.node();
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   * Signals if any of the slider was moved
   * @returns {boolean}
     */
  hasChanged(): boolean
  {
    var changed = this.changed;
    this.changed = false;
    return changed;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param name
   * @param val
   * @returns {*}
     */
  option(name: string, val?: any)
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
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param range
   * @returns {Promise<Rect>}
     */
  locateImpl(range: ranges.Range)
  {
    var size = this.size;

    return Promise.resolve(geom.rect(0, 0,size[0], size[1]));
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param scale
   * @param rotate
   * @returns {any}
     */
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

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param vec
   * @returns {*[]}
   * @private
     */
  private _buildTicks(vec: any, range: number[]): number[]
  {
    // obtain number of bins
    const numBins = this.options.bins;

    // define extents of vector and ticks

    var dist = (range[1] - range[0]) / numBins;
    // build tick array
    return Array.apply(null, Array(numBins + 1)).map((_, i: number) => { return range[0] + i * dist; });
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param $root
   * @param vec
   * @param rawSize
     */
  private _buildHistogram($root: d3.Selection<any>, vec: any, rawSize: number[])
  {
    var range = d3.extent(vec);

    // build ticks array
    var ticks = this._buildTicks(vec, range);

    // define scales
    var scaleX = d3.scale.linear().domain(range).range([this.options.padding, rawSize[0]]);
    range = <any>scaleX.domain();

    // build histogram
    this.bars = d3.layout.histogram().bins(ticks).frequency(true)(vec);

    // set bar offset
    var barOffset = rawSize[1] * this.options.barOffsetRatio;
    var maxOffset = rawSize[1] - barOffset;

    // scale in y-direction from [0, maxNumInBin] to [Height, 0]
    var scaleY = d3.scale.linear()
      .domain([0, d3.max(this.bars, (d: any) => { return d.y; }) ])
      .range([rawSize[1] - barOffset, barOffset]);

    // create bars by taking the histogram objects and creating groups that are transformed to the bars' final position
    var bars = $root.selectAll('bars').data(this.bars).enter()
      .append('g').attr({
        'class': 'bar',
        'transform': (d: any) => { return 'translate(' + scaleX(d.x) + ',' + scaleY(d.y) + ')'; }
      });

    // now create the rectangles representing the bars. Map height conversely.
    bars.append('rect').attr({
        x: 0,
        width: scaleX(this.bars[0].dx + range[0]) - this.options.padding * 2,
        height: (d: any) => { return maxOffset - scaleY(d.y); },
        'fill': this.options.barColor, id: 'histoBar'
      });

  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param $root
   * @param vec
   * @param rawSize
     * @private
     */
  private _buildSlider($root: d3.Selection<any>, vec: any, rawSize: number[])
  {
    var range = d3.extent(vec);
    const numBins = this.options.bins;

    // build ticks array
    var ticks = this._buildTicks(vec, range);

    // define scales
    var scaleX = d3.scale.linear().domain(range).range([0, rawSize[0] - this.options.padding]);

    var that = this;

     // -----------------------------------------------------------------------------------------------------------------

    /**
     * Drag movement behavior of the sliders.
     * @param d
       */
    function dragMove(d: any)
    {
      var x = d3.event.x;

      var id = d3.select(this).attr('id');
      var number = parseInt(id.slice(-1));
      var pos = Math.max(0, Math.min(rawSize[0] - that.options.padding, Math.max(0, x)));

      var borders = [0, numBins];

      if (that.options.numSlider > 1)
      {
        if (number == that.options.numSlider - 1)
        {
          borders = [that.divisions[number - 1] + 1, numBins];
        }
        else if (number == 0)
        {
          borders = [0, that.divisions[number + 1] - 1];
        }
        else
        {
          borders = [that.divisions[number - 1] + 1, that.divisions[number + 1] - 1];
        }

        var nearestIndex = nearestTickIndex(pos, borders);

        if (nearestIndex != that.divisions[number])
        {
          that.changed = true;
        }

        that.divisions[number] = nearestIndex;
        d3.select(this).transition().duration(that.options.animationTime).attr('x', scaleX(ticks[nearestIndex]));
        that._colorizeBars();
      }
    }

    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Find the tick / bar in the histogram nearest to the currently selected slider position. Set the slider to this
     * tick and update its index.
     * @param pos
     * @param borders
     * @returns {number}
       */
    function nearestTickIndex(pos: number, borders: number[])
    {
      var dists = ticks.map(function(d) { return scaleX(d) - pos; });

      var index = 0;
      var tickDist = scaleX(ticks[1]) - scaleX(ticks[0]);
      var threshold = -tickDist / 2.0;

      while (dists[index] < threshold) { index++; }

      return Math.min(borders[1], Math.max(borders[0], index));
    }

    function originFunc() : any
    {
      var obj: d3.Selection<any> = d3.select(this);
      return { x: obj.attr('x'), y: obj.attr('y') };
    }

    var drag = d3.behavior.drag()
        .origin(originFunc)
        .on('drag', dragMove);

    // build range sliders
    for (var i = 0; i < this.options.numSlider; ++i)
    {
      // set new division at index sliderStarts[i]
      const sliderIndex = this.options.sliderStarts[i];
      const sliderRadius = 2;

      this.divisions.push(sliderIndex);
      var slider = $root.append('rect').attr(
      {
        x: scaleX(ticks[sliderIndex]), width: that.options.padding,
        height: rawSize[1],
        fill: that.options.sliderColor,
        id: 'slider' + String(i),
        rx: sliderRadius, ry: sliderRadius
      });

      slider.call(drag);
      this.sliders.push(slider);
    }

  }

  // -------------------------------------------------------------------------------------------------------------------

  private _colorizeBars()
  {
    var descs: any[] = [];
    var colors = ['darkgreen', '#aa8800', 'darkred'];

    // build descriptions
    for (var i = 0; i < this.options.numSlider + 1; ++i)
    {
      var minIndex = (i == 0) ? 0 : this.divisions[i - 1];
      var maxIndex = (i == this.options.numSlider) ? this.options.bins : this.divisions[i];
      var range = [minIndex, maxIndex];

      descs.push({ range: range, color: colors[i] });

      minIndex = maxIndex;
    }

    // TODO! replace this by discrete scaling function (d3)
    function colorize(_: any, i: number)
    {
      for (var j = 0; j < descs.length; ++j)
      {
        var colDesc = descs[j];
        if (i < colDesc.range[1] && i >= colDesc.range[0])
        {
          return colDesc.color;
        }
      }
    }

    this.$node.selectAll('#histoBar').transition().duration(this.options.animationTime).attr('fill', colorize);
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @returns {Array}
   * @private
     */
  private _getNumElementsPerBin() : number[]
  {
    var numElements = [];
    var numEntries = this.options.numSlider + 1;

    for (var i = 0; i < numEntries; ++i)
    {
      var sum = 0;
      var index = (i == 0) ? 0 : this.divisions[i - 1];
      var maxIndex = (i == numEntries - 1) ? this.options.bins : this.divisions[i];
      while(index < maxIndex)
      {
        sum += this.bars[index].length;
        index++;
      }

      numElements.push(sum);
    }

    return numElements;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @returns {Array}
     */
  getDivisionRanges() : any[]
  {
    var numElements = this._getNumElementsPerBin();
    var numRanges = this.options.numSlider + 1;
    var ranges = [];

    var total = 0;

    for (var j = 0; j < numRanges; ++j)
    {
      var num = numElements[j];

      ranges.push(this.labels.slice(total, num + total));

      total += num;
    }

    return ranges;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param $parent
   * @returns {Selection<any>}
     */
  private build($parent: d3.Selection<any>)
  {
    var scaling = this.options.scale;
    var size = this.size;
    var rawSize = this.rawSize;

    var $svg = $parent.append('svg').attr({
      width: size[0], height: size[1], 'class': 'clusterslider'
    });

    var $root = $svg.append('g').attr('transform', 'scale(' + scaling[0] + ',' + scaling[1] + ')');

    // make pointer to this object
    const that = this;

    // obtain data for the histogram
    this.histoData.data().then(function(vec)
    {
      that._buildHistogram($root, vec, rawSize);
      that._buildSlider($root, vec, rawSize);
      that._colorizeBars();

      that.markReady();
    });

    return $svg;
  }

  // ------------------------------------------------------------------------------------------------------------------

  /**
   * destroys the node of this object
   */
  destroy()
  {
    this.$node.remove();
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// creator functions

/**
 *
 * @param histoData
 * @param data
 * @param parent
 * @param options
 * @returns {ClusterDivider}
 */
export function create(histoData: vector.IVector, labels: number[],
                       data: matrix.IMatrix, parent: Element, options: any) : vis.AVisInstance
{
  return new ClusterDivider(histoData, labels, data, parent, options);
}
