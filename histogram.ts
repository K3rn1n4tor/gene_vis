/**
 * Created by Michael Kern on 18.01.2016.
 */

'use strict';

import d3 = require('d3')
import vis = require('../caleydo_core/vis');
import vector = require('../caleydo_core/vector');

import geom = require('../caleydo_core/geom');
import ranges = require('../caleydo_core/range');
import C = require('../caleydo_core/main');

export class Histogram extends vis.AVisInstance implements vis.IVisInstance
{
  private $node : d3.Selection<any>;
  private histo : any;

  constructor(public data: any, public parent: Element, private options: any)
  {
    super();
    this.options = C.mixin({
      scale: [1, 1],
      rotate: 0,
      bins: 20}, options);

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

  get rawSize(): [number, number]
  {
    return [300, 50]
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

    var $svg = $parent.append('svg').attr({
      width: size[0],
      height: size[1],
      'class': "histogram"
    });

    var $root = $svg.append('g').attr('transform', 'scale(' + scaling[0] + ',' + scaling[1] + ')');

    var numBins = this.options.bins;
    var that = this;

    this.data.data().then(function(vec)
    {

      var range = d3.extent(vec);
      var dist = (range[1] - range[0]) / (numBins);
      var ticks = [];

      for (var i = 0; i < numBins + 1; ++i) {
        ticks.push(range[0] + i * dist);
      }
      //var minX = Math.floor(range[0]);
      //var maxX = Math.ceil(range[1]);
      //range = [minX, maxX];

      // scales
      var scaleX = d3.scale.linear().domain(range).range([0, rawSize[0]]);
      range = <any>scaleX.domain();

      that.histo = d3.layout.histogram().bins(ticks).frequency(true)(vec);
      //console.log(this.histo);

      var scaleY = d3.scale.linear()
        .domain([0, d3.max(that.histo, (d) => (<any>d).y)]).range([rawSize[1], 0]);

      var bars = $root.selectAll('bars').data(that.histo).enter()
        .append('g').attr({
          'class': 'bar',
          'transform': (d) => 'translate(' + scaleX((<any>d).x) + ',' + scaleY((<any>d).y) + ')'
        });

      bars.append('rect').attr({
        x: 2, width: Math.max(scaleX(that.histo[0].dx + range[0]), 2) - 4,
        height: (d) => rawSize[1] - scaleY((<any>d).y),
        'fill': '#334433'
      });

      //console.log(this.histo);
      //console.log(this.histo[0].dx);

      that.markReady();
    });

    return $svg;
  }

  public getNumBinElements(range : [number, number]) : number
  {
    var num = 0;
    for (var i = range[0]; i < range[1]; ++i)
    {
      num += this.histo[i].length;
    }

    return num;
  }

  // expect something like [{range: [], color: 'any'}, {...}]
  public colorBars(desc: any)
  {
    function colorize(d, i)
    {
      for(var j = 0; j < desc.length; ++j)
      {
        var colDesc = desc[j];
        if (i < colDesc.range[1] && i >= colDesc.range[0])
        {
          return colDesc.color;
        }
      }
    }

    this.$node.selectAll('rect').attr('fill', colorize);
  }
}

export function create(data: vector.IVector, parent: Element, options: any) : vis.AVisInstance
{
  return new Histogram(data, parent, options);
}
