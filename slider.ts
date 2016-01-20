/**
 * Created by Michael Kern on 19.01.2016.
 */

'use strict';

/* required modules */
import d3 = require('d3');
import vis = require('../caleydo_core/vis');
import vector = require('../caleydo_core/vector');

import geom = require('../caleydo_core/geom');
import ranges = require('../caleydo_core/range');
import C = require('../caleydo_core/main');

export class DiscreteSlider extends vis.AVisInstance implements vis.IVisInstance
{
  private $node: d3.Selection<any>;
  private indices = [];
  private values = [];
  private sliders = [];

  constructor(public data: any, public parent: Element,
              public numSlider: number, private options: any)
  {
    super();
    this.options = C.mixin({
      scale:[1, 1],
      rotate: 0,
      bins: 10}, options);

    this.$node = this.build(d3.select(parent));
    this.$node.datum(data);
    vis.assignVis(<Element>this.$node.node(), this);
  }

  get rawSize(): [number, number]
  {
    return [300, 50];
  }

  get node()
  {
    return <Element>this.$node.node();
  }

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

  locateImpl(range: ranges.Range)
  {
    var size = this.size;

    return Promise.resolve(geom.rect(0, 0,size[0], size[1]));
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

  private build($parent: d3.Selection<any>)
  {
    var scaling = this.options.scale;
    var size = this.size;
    var rawSize = this.rawSize;

    // use ordinal scale to create range bands
    var $svg = $parent.append('svg').attr({
      width: size[0],
      height: size[1],
      'class': 'slider'
    });

    var range = d3.extent(this.data);
    var numBins = this.options.bins;

    var $root = $svg.append('g')
      .attr('transform', 'scale(' + scaling[0] + ',' + scaling[1] + ')');

    var barHeight = 5;
    var sliderWidth = 5;

    var that = this;

    function dragMove(d)
    {
      var x = d3.event.x;

      var id = d3.select(<any>this).attr('id');
      var number = parseInt(id.slice(-1));
      var pos = Math.max(0, Math.min(rawSize[0] - sliderWidth, Math.max(0, x)));

      var borders = [0, numBins + 1];

      if (that.numSlider > 1)
      {
        if (number == that.numSlider - 1)
        {
          borders = [that.indices[number - 1] + 1, numBins];
        }
        else if (number == 0)
        {
          borders = [0, that.indices[number + 1] - 1];
        }
        else
        {
          borders = [that.indices[number - 1] + 1, that.indices[number + 1] - 1];
        }

        var nearestIndex = nearestTickIndex(pos, borders);
        that.indices[number] = nearestIndex;
        that.values[number] = scale.invert(ticks[nearestIndex]);
        d3.select(this).attr('x', ticks[nearestIndex]);
      }
    }

   function nearestTickIndex(pos, borders)
    {
      var dists = ticks.map(function(d) { return d - pos; });
      //console.log(dists);

      var index = 0;
      var dist = -(ticks[1] - ticks[0]) / 2;

      while (dists[index] < dist)
      {
        index++;
      }

      return Math.min(borders[1], Math.max(borders[0], index));
    }

    function originFunc() : any
    {
      var that = <any>this;
      var obj = d3.select(that);
      return { x: <any>obj.attr('x'), y: <any>obj.attr('y') };
    }

    var drag = d3.behavior.drag()
      .origin(originFunc)
      .on('drag', dragMove);

    var bar = $root.append('rect').attr({
        y: rawSize[1] / 2 - barHeight / 2, 'height': barHeight, width: rawSize[0], 'fill': '#cccccc'
      });

    var scale = d3.scale.linear().domain(range).range([0, rawSize[0] - sliderWidth]);
    var dist = (range[1] - range[0]) / numBins;
    var ticks = d3.range(numBins + 1).map((d) => { return scale(range[0] + <any>d * dist); });

    for (var i = 0; i < this.numSlider; ++i)
    {
      this.sliders[i] = $root.append('rect').attr({
        x: String(ticks[i]),
        width: sliderWidth, height: size[1], 'fill': 'steelblue', 'id': 'slider' + String(i)
      });

      this.sliders[i].call(drag);

      this.indices[i] = i;
      this.values[i] = scale.invert(ticks[i]);
    }

    this.markReady();

    return $svg;
  }

  public getIndex(index: number)
  {
    return this.indices[index];
  }

  public getValue(index: number)
  {
    return this.values[index];
  }
}

export function create(data: any, parent: Element, numSlider: number, options: any) : vis.AVisInstance
{
  return new DiscreteSlider(data, parent, numSlider, options)
}
