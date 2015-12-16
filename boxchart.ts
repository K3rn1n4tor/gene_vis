/**
 * Created by Michael Kern on 15.12.2015.
 */

/* global defines */
'use strict';

/* required modules */
import d3 = require('d3');
import vis = require('../caleydo_core/vis');
import vector = require('../caleydo_core/vector');

import geom = require('../caleydo_core/geom');
import ranges = require('../caleydo_core/range');
import C = require('../caleydo_core/main');

// define new class
export class BoxChart extends vis.AVisInstance implements vis.IVisInstance
{
  private $node : d3.Selection<any>;
  private $parent : Element;

  constructor(public data: vector.IVector, public parent: Element, private options: any)
  {
    super();
    this.options = C.mixin({
      scale:[5, 2],
      rotate: 0}, options);

    this.$node = this.build(d3.select(parent));
    this.$node.datum(data);
    vis.assignVis(<Element>this.$node.node(), this);
  }

  get rawSize(): [number, number]
  {
    var d = this.data.dim;
    return [d[0], 100];
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

  updateGraph(data: vector.IVector)
  {
    d3.select('.box_chart').remove();

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

    // use ordinal scale to create range bands
    var $svg = $parent.append('svg').attr({
      width: size[0],
      height: size[1],
      'class': 'box_chart'
    });

    var $root = $svg.append('g').attr('transform', 'scale(' + scaling[0] + ',' + scaling[1] + ')');

    this.data.data().then( (vec) => {
      // use this scale to create bands
      var xScale = d3.scale.ordinal();
      xScale.domain(<any>d3.range(vec.length)).rangeBands([0, rawSize[0]], 0.10);

      var yScale = d3.scale.linear().domain(d3.extent(vec)).range([rawSize[1], 0]).nice();

      var zeroLine = yScale(0);

      // color palette
      var value = (<any>this.data.desc).value;
      const r = value.range;

      var cDomainHigh = [0, r[1]];
      var cDomainLow = [r[0], 0];

      var highScale = d3.scale.linear().domain(cDomainHigh).range(<any[]>['darkred', 'red']);
      var lowScale = d3.scale.linear().domain(cDomainLow).range(<any[]>['green', 'darkgreen']);

      var bars = $root.selectAll('rect').data(vec).enter().append('rect');
      bars.attr({
        'x': (d, i) => {
          return xScale(<any>i);
        },
        'y': (d) => d3.min([zeroLine, yScale(<any>d)]),
        'width': <any>xScale.rangeBand(),
        'height': (d) => d3.max([zeroLine, yScale(<any>d)]) - d3.min([zeroLine, yScale(<any>d)]),
        'fill': (d) => { if (d < 0) { return lowScale(d); } else { return highScale(d); } }
      });

      this.markReady();
    });

    return $svg;
  }
}

export function create(data: vector.IVector, parent: Element, options: any) : vis.AVisInstance
{
  return new BoxChart(data, parent, options);
}
