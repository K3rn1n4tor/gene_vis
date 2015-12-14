/**
 * Created by Samuel Gratzl on 05.08.2014.
 */
/// <reference path="../../tsd.d.ts" />
//depend on a css dependency
/// <amd-dependency path='css!./style' />

/* global define */
import {IVector} from "../caleydo_core/vector";
'use strict';

// first import required modules
import d3 = require('d3')
import vis = require('../caleydo_core/vis')
import vector = require('../caleydo_core/vector')

import geom = require('../caleydo_core/geom')
import ranges = require('../caleydo_core/range')
import C = require('../caleydo_core/main')

// define new class, use export to make it accessible outside of this file
export class LineGraph extends vis.AVisInstance implements vis.IVisInstance
{
  // define member variables
  private $node : d3.Selection<any>;
  private $parent : Element;

  // implement constructor, access varname : type
  constructor(public data: vector.IVector, public parent: Element, private options: any)
  {
    // invoke super constructor
    super();
    // mix options into default options
    this.options = C.mixin({
      scale: [4, 2],
      rotate: 0}, options);
    // invoke build method to create svg element
    this.$parent = parent;
    this.$node = this.build(d3.select(parent));
    // assign data to svg element
    this.$node.datum(data);
    // ? maybe register new vis
    vis.assignVis(<Element>this.$node.node(), this);
  }

  /**
   * the raw size without any scaling factors applied
   * @returns {any[])
   */
  get rawSize(): [number, number]
  {
    var d = this.data.dim;
    return [d[0], 100];
  }

  /**
   * returns the HTML element of this visualization
   * @return {Element}
   */
  get node()
  {
    return <Element>this.$node.node();
  }

  /**
   * get/set an option of this vis
   * @param name
   * @param val
   * @returns {any}
   */
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

  /**
   * locate a range of items and returning their geometric position
   * @param range
   * @returns {IPromise<any>}
   */
  locateImpl(range: ranges.Range) {
    var dims = this.data.dim;
    var maxY = dims[0];
    var o = this.options;

    console.log('invoked line_graph.locateImpl method');
    // TODO: understand and implement locating

    return this.data.data(range).then((data) => {
      // TODO return geometric position
      console.log(data);
      return geom.rect(0, 0, dims[0], dims[1]);
    });
  }

  /**
   * transforms this visualization given the scaling and rotation factor
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

  /**
   *
   * @param data
     */
  updateGraph(data: vector.IVector)
  {
    console.log('update linechart')
    // destroy svg element
    d3.select('.line_graph').remove();
    // assign new  data to svg element
    this.data = data;
    this.$node = this.build(d3.select(this.$parent));
    this.$node.datum(data);
    vis.assignVis(<Element>this.$node.node(), this);
  }

  /**
   *
   * @param $parent
   * @returns {Selection<any>}
     */
  private build($parent: d3.Selection<any>)
  {
    // gather all required info
    var scaleFactor = this.options.scale;
    var size = this.size;
    var rawSize = this.rawSize;

    // create an ew svg element
    var $svg = $parent.append('svg').attr({
     width: size[0], // set size of svg element
     height: size[1],
     'class': 'line_graph' // assign it a class name
    });

    // set group element as root (needed for transformation)
    var $root = $svg.append('g').attr('transform', 'scale(' + scaleFactor[0] + ',' + scaleFactor[1] + ')');

    // obtain data from vis and create vis elements
    this.data.data().then((vec) => {
      console.log("line_graph.build is invoked");
      console.log(size);
      // set scales
      var $xScale = d3.scale.linear().domain([0, this.data.dim[0]]).range([0, rawSize[0]]);
      var $yScale = d3.scale.linear().domain(d3.extent(vec)).range([rawSize[1], 0]);

      console.log('vector extent = ' + d3.extent(vec).toString());

      //var test = [];
      // test
      //vec.forEach( (v) => { test.push({ 'val': v }); });

      // compute lines
      var $lineFunction = d3.svg.line()
        .x( (d, i) => { return $xScale(i); })
        .y( (d) => { return $yScale(<any>d); })
        .interpolate('linear');

      // create path element
      $root.append('line')
        .attr({'x1': 0, 'y1': $yScale(0),
               'x2': size[0], 'y2': $yScale(0),
              'class': 'zeroLine'
          });

      $root.append('path').datum(vec)
        .attr({'class': 'line',
              'd': <any>$lineFunction,
              'fill': 'none'});

      this.markReady();
    });

    return $svg;
  }
}

// export create function to create a new LineGraph instance
export function create(data: vector.IVector, parent: Element, options)
{
  return new LineGraph(data, parent, options);
}

