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
  private divisions: any[] = [];
  private changed = false;
  private numBars = 0;
  private sliders: any[] = [];
  private labels: any[] = [];
  private boxValues: any[] = [];
  private $tooltip: d3.Selection<any>;

  constructor(public data: any, public parent: Element, private options: any)
  {
    super();
    this.options = C.mixin({
      scale: [1, 1],
      rotate: 0,
      numAvg: 10,
      numSlider: 2,
      sliderColor: 'grey',
      sliderStarts: [1,3],
      animationTime: 50,
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
    this.colorizeBars();
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
   * @returns {boolean}
     */
  hasChanged()
  {
    var temp = this.changed;
    this.changed = false;
    return temp;
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
   * @param labels
     */
  setLabels(labels: any[])
  {
    this.labels = labels;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @returns {any[]}
     */
  getCurrentDivisions()
  {
    return this.divisions;
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
   * @returns {Array}
     */
  getDivisionRanges(): any[]
  {
    if (this.labels.length == 0) { return; }

    var ranges = [];

    var numRanges = this.options.numSlider + 1;

    for (var j = 0; j < numRanges; ++j)
    {
      var minIndex = (j == 0) ? 0 : this.divisions[j - 1];
      var maxIndex = (j == numRanges - 1) ? this.numBars : this.divisions[j];

      var minI = minIndex * this.options.numAvg;
      var maxI = Math.min(maxIndex * this.options.numAvg, this.labels.length);

      ranges.push(this.labels.slice(minI, maxI));
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
    //var rawSize = this.rawSize;

    var $svg = $parent.append('svg').attr({
      width: size[0], height: size[1], 'class': 'boxslider'
    });

    var $root = $svg.append('g').attr('transform', 'scale(' + scaling[0] + ',' + scaling[1] + ')');

    const that = this;

    function buildComponents(vec: any)
    {
      that.buildBoxPlot($root, vec);
      that.buildSlider($root, vec);

      that.markReady();
    }

    if (this.data instanceof Array)
    {
      buildComponents(this.data);
    }
    else
    {
      this.data.data().then( (vec: any) =>
      {
        buildComponents(vec);
      });
    }

    return $svg;
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param type
   * @param $root
   * @param args
   * @returns {function(any): undefined}
     * @private
     */
  private _mouseHandler(type: string, $root: d3.Selection<any>, args: any)
  {
    var that = this;

    if (type == 'mouseover' || type == 'mousemove')
    {
      var scaleY = args[0];

      return function(_: any)
      {
        const mousePos = d3.mouse($root.node());
        const posY = mousePos[1];

        const absPos = d3.mouse(that.parent);
        const absPosX = absPos[0];
        //const absPosY = absPos[1];

        var index = d3.round(scaleY.invert(posY) - 0.5);
        var value = d3.round(that.boxValues[index], 2);

        index = Math.min(that.numBars - 1, Math.max(0, index));
        var absPosY = $(that.$node.select('.bar' + index).node()).position().top;

        if (type == 'mousemove') {  that.colorizeBars(); }

        that.$node.select('.bar' + index).datum(value)
          .transition().duration(that.options.animationTime).attr('fill', 'darkorange');

        //d3.select(this).transition().duration(that.options.animationTime).attr('fill', 'darkorange');

        that.$tooltip.style('opacity', 1);
        that.$tooltip.html('Distance: ' + String(value));
        that.$tooltip.style({ left: (absPosX + 5) + 'px', top: (absPosY) + 'px' });

      }
    }
    else if (type == 'mouseout')
    {
      return function(_: any)
      {
        that.$tooltip.style('opacity', 0);
        that.colorizeBars();
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param $root
   * @param vec
     */
  private buildBoxPlot($root: d3.Selection<any>, vec: any)
  {
    const that = this;

    const rawSize = this.rawSize;

    const numElems = vec.length;
    this.options.numAvg = (numElems < this.options.numAvg * (this.options.numSlider + 1)) ? 1 : this.options.numAvg;
    const numBars = Math.ceil(numElems / this.options.numAvg);
    this.numBars = numBars;
    const barHeight = rawSize[1] / numBars;

    for (var i = 0; i < numBars; ++i)
    {
      var startIndex = i * this.options.numAvg;
      var endIndex = Math.min(startIndex + this.options.numAvg, vec.length);
      var subSlice = vec.slice(startIndex, endIndex);
      this.boxValues.push(d3.mean(subSlice));
    }

    var range = (this.options.range) ? this.options.range : d3.extent(this.boxValues);

    var scaleY = d3.scale.linear().domain([0, numBars - 1]).range([0, rawSize[1] - barHeight]);
    var scaleX = d3.scale.linear().domain(range).range([5, rawSize[0]]);

    // create dummy rect to detect hovering event
    $root.append('rect').attr({ width: rawSize[0], height: rawSize[1], opacity: 0 })
      .on('mousemove', this._mouseHandler('mousemove', $root, [scaleY]))
      .on('mouseout', this._mouseHandler('mouseout', $root, []));

    // create groups that contain the bars
    var bars = $root.selectAll('g').data(this.boxValues)
      .enter().append('g').attr({
        id: 'barGroup', class: 'bar', 'transform': (d: any, i: number) => { return 'translate(0, ' + scaleY(i) + ')'; },
      });

    this.$tooltip = d3.select(this.parent).append('div').attr({
      class: 'tooltip'
    }).style({ opacity: 0, position: 'absolute !important', 'background': '#60AA85', width: '100px',
      'font-size:': '14px', 'border-radius': '4px', 'text-align': 'center', padding: 0, margin: 0,
      'pointer-events': 'none', left: 0, top: 0, 'color': 'white'});


    // create the bars
    bars.append('rect').attr({
      x: 0, y: 0,
      width: (d: any) => { return scaleX(d); }, height: barHeight,
      'fill': 'steelblue', id: 'bar', class: (_: any, i: number) => { return 'bar' + String(i); }
    }).on('mouseover', this._mouseHandler('mouseover', $root, [scaleY]))
      .on('mouseout', this._mouseHandler('mouseout', $root, []));
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param type
   * @param $root
   * @param args
   * @returns {function(any): undefined}
     * @private
     */
  private _dragHandler(type: string, $root: d3.Selection<any>, args: any)
  {
    var that = this;

    if (type == 'dragstart')
    {
      barHeight = args[0];
      scaleY = args[1];

      return function(_: any)
      {
        const rawSize = that.rawSize;
        const scaling = that.options.scale;
        const width = rawSize[0] * scaling[0];

        var id = d3.select(this).attr('id');
        var number = parseInt(id.slice(-1));
        $root.select('.sliderBar' + number).transition().duration(that.options.animationTime)
          .attr('fill', 'darkorange');

        var mousePos = d3.mouse($root.node());
        var posY = mousePos[1];

        var newIndex = d3.round(scaleY.invert(posY));
        var maxIndex = Math.max(0, Math.min(that.numBars - 1, newIndex));
        var minIndex = Math.max(0, Math.min(that.numBars - 1, newIndex - 1));

        var value = d3.round((that.boxValues[minIndex] + that.boxValues[maxIndex]) / 2, 2);
        that.$tooltip.style('opacity', 1);
        that.$tooltip.html('Distance: ' + String(value));
        var sliderPosY = $(that.sliders[number].node()).position().top;
        var sliderHeight = barHeight * scaling[1];
        that.$tooltip.style({ left: width + 'px', top: (sliderPosY + sliderHeight * 1.5 - 8.5) + 'px' });

        that.$node.select('.bar' + minIndex).datum(that.boxValues[minIndex])
          .transition().duration(that.options.animationTime).attr('fill', 'darkorange');
        that.$node.select('.bar' + maxIndex).datum(that.boxValues[maxIndex])
          .transition().duration(that.options.animationTime).attr('fill', 'darkorange');
      }
    }

    else if (type == 'drag')
    {
      var barCover = args[0];
      var barHeight = args[1];
      var scaleY = args[2];

      return function(_: any)
      {
        const rawSize = that.rawSize;
        const scaling = that.options.scale;
        const width = rawSize[0] * scaling[0];

        var id = d3.select(this).attr('id');
        var number = parseInt(id.slice(-1));
        var index = that.divisions[number];

        var mousePos = d3.mouse($root.node());
        var posY = mousePos[1];

        var newIndex = d3.round(scaleY.invert(posY));

        // define borders
        var borders = [0, that.numBars];
        if (that.options.numSlider > 1)
        {
          var leftIndex = (number == 0) ? 0 :  that.divisions[number - 1] + 1;
          var rightIndex = (number == that.options.numSlider - 1) ? that.numBars : that.divisions[number + 1] - 1;
          borders = [leftIndex, rightIndex];
        }

        newIndex = Math.min(borders[1], Math.max(borders[0], newIndex));

        // obtain two values nearby slider
        var minIndex = Math.max(0, newIndex - 1);
        minIndex = Math.min(borders[1], Math.max(Math.max(borders[0] - 1, 0), minIndex));
        var maxIndex = Math.min(that.numBars - 1, newIndex);
        maxIndex = Math.min(borders[1], Math.max(borders[0], maxIndex));

        // show average values of both distances
        var value = d3.round((that.boxValues[minIndex] + that.boxValues[maxIndex]) / 2, 2);
        //var mousePos = d3.mouse(that.parent);
        that.$tooltip.style('opacity', 1);
        that.$tooltip.html('Distance: ' + String(value));

        if (newIndex != index)
        {
          that.sliders[number].transition().duration(that.options.animationTime)
            .attr('transform', 'translate(0,' + (scaleY(newIndex) - barCover / 2) + ')');

          that.divisions[number] = newIndex;
          that.changed = true;
        }

        var sliderPosY = $(that.sliders[number].node()).position().top;
        var sliderHeight = barHeight * scaling[1];
        that.$tooltip.style({ left: width + 'px', top: (sliderPosY + sliderHeight * 1.5 - 8.5) + 'px' });

        that.colorizeBars();
        that.$node.select('.bar' + minIndex).datum(that.boxValues[minIndex])
          .transition().duration(that.options.animationTime).attr('fill', 'darkorange');
        that.$node.select('.bar' + maxIndex).datum(that.boxValues[maxIndex])
          .transition().duration(that.options.animationTime).attr('fill', 'darkorange');
      }
    }

    else if (type == 'dragend')
    {
      return function(_: any)
      {
        var id = d3.select(this).attr('id');
        var number = parseInt(id.slice(-1));

        that.$tooltip.style('opacity', 0);
        that.colorizeBars();

        $root.select('.sliderBar' + number).transition().duration(that.options.animationTime)
            .attr('fill', that.options.sliderColor);
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   * @param $root
   * @param vec
     */
  private buildSlider($root: d3.Selection<any>, vec: any)
  {
    const that = this;

    const rawSize = this.rawSize;
    const scaling = this.options.scale;

    const barHeight = rawSize[1] / this.numBars / 2; //8 / scaling[1];
    const barCover = 3 * barHeight;

    var scaleY = d3.scale.linear().domain([0, this.numBars]).range([0, rawSize[1]]);

    var dragSlider = d3.behavior.drag()
      .on('dragstart', this._dragHandler('dragstart', $root, [barHeight, scaleY]))
      .on('drag', this._dragHandler('drag', $root, [barCover, barHeight, scaleY]))
      .on('dragend', this._dragHandler('dragend', $root, []));

    for (var i = 0; i < this.options.numSlider; ++i)
    {
      const sliderIndex = this.options.sliderStarts[i];
      const sliderRadius = 16 + 'px';

      var group = $root.append('g').attr(
      {
        id: 'slider' + String(i),
        'transform': 'translate(0,' + (scaleY(sliderIndex) - barCover / 2) + ')',
      });

      var container = group.append('rect').attr(
      {
        id: 'slider' + String(i),
        width: rawSize[0], height: barCover, opacity: 0
      }).on('mouseover', this._mouseHandler('mouseover', $root, [scaleY]))
        .on('mouseout', this._mouseHandler('mouseout', $root, []));

      var slider = group.append('rect').attr(
      {
        id: 'slider' + String(i), class: 'sliderBar' + String(i),
        y: barCover / 2 - barHeight / 2, height: barHeight + 'px', width: rawSize[0], fill: that.options.sliderColor,
        rx: sliderRadius, ry: sliderRadius, opacity: 0.75
      });

      container.call(dragSlider);
      slider.call(dragSlider);
      this.sliders.push(group);
      this.divisions.push(sliderIndex);
    }

  }

  // -------------------------------------------------------------------------------------------------------------------

  /**
   *
   */
  private colorizeBars()
  {
    var descs: any[] = [];
    var colors = ['darkgreen', '#aa8800', 'darkred'];

    // build descriptions
    for (var i = 0; i < this.options.numSlider + 1; ++i)
    {
      var minIndex = (i == 0) ? 0 : this.divisions[i - 1];
      var maxIndex = (i == this.options.numSlider) ? this.numBars : this.divisions[i];
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

    this.$node.selectAll('#bar').transition().duration(this.options.animationTime).attr('fill', colorize);
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
