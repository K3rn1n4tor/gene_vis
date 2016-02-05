/**
 * Created by Michael Kern on 15.12.2015.
 */

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
// class declaration
export class BoxSlider extends vis.AVisInstance implements vis.IVisInstance
{
  private $node: d3.Selection<any>;

  constructor(public data: any, public parent: Element, private options: any)
  {
    super();
    this.options = C.mixin({
      scale: [1, 1],
      rotate: 0,
      numSlider: 2,
      sliderColor: 'grey',
      animationTime: 50
    }, options);

    if (this.options.scaleTo)
    {
      var scaling = this.options.scaleTo;
      var raw = this.rawSize;
      this.options.scale = raw.map((d, i) => { return scaling[i] / d });
    }

    this.$node = this.build(d3.select(this.parent));
    this.$node.datum(data);
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
   * @param $parent
   * @returns {Selection<any>}
     */
  private build($parent: d3.Selection<any>)
  {
    var scaling = this.options.scale;
    var size = this.size;
    //var rawSize = this.rawSize;

    var $svg = $parent.append('svg').attr({
      width: size[0], height: size[1], 'class': 'boxslider'
    });

    var $root = $svg.append('g').attr('transform', 'scale(' + scaling[0] + ',' + scaling[1] + ')');

    const that = this;

    if (this.data instanceof Array)
    {
      that.buildBoxPlot($root, this.data);

      that.markReady();
    }
    else
    {
      this.data.data().then( (vec: any) =>
      {
        that.buildBoxPlot($root, vec);

        that.markReady();
      });
    }

    return $svg;
  }

  private buildBoxPlot($root: d3.Selection<any>, vec: any)
  {
    const that = this;

    const rawSize = this.rawSize;

    const numSum = 10;
    const numElems = vec.length;
    const numBars = numElems / numSum;
    const barHeight = rawSize[1] / numBars;

    var avgVec = [];

    for (var i = 0; i < numBars; ++i)
    {
      var startIndex = i * numSum;
      var endIndex = Math.min(startIndex + numSum, vec.length);
      var subSlice = vec.slice(startIndex, endIndex);
      avgVec.push(d3.mean(subSlice));
    }

    var range = d3.extent(avgVec);

    var scaleY = d3.scale.linear().domain([0, numBars - 1]).range([0, rawSize[1] - barHeight]);
    var scaleX = d3.scale.linear().domain(range).range([5, rawSize[0]]);

    // create groups that contain the bars
    var bars = $root.selectAll('g').data(avgVec)
      .enter().append('g').attr({
        class: 'bar', 'transform': (d: any, i: number) => { return 'translate(0, ' + scaleY(i) + ')'; }
      });

    // create the bars
    bars.append('rect').attr({
      x: 0, y: 0,
      width: (d: any) => { return scaleX(d); }, height: barHeight,
      'fill': 'steelblue', id: 'bar'
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

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
 * @param data
 * @param parent
 * @param options
 * @returns {ClusterDivider}
 */
export function create(data: vector.IVector, parent: Element, options: any) : vis.AVisInstance
{
  return new BoxSlider(data, parent, options);
}

export function createRaw(data: Array<any>, parent: Element, options: any) : vis.AVisInstance
{
  return new BoxSlider(data, parent, options);
}
