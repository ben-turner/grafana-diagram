import mermaidAPI from './libs/mermaid/dist/mermaidAPI';
import TimeSeries from 'app/core/time_series2';
import kbn from 'app/core/utils/kbn';
import {
  MetricsPanelCtrl,
} from 'app/plugins/sdk';
import {
  diagramEditor,
  displayEditor,
  compositeEditor,
} from './properties';
import _ from 'lodash';
import './series_overrides_diagram_ctrl';
import './css/diagram.css!';
import PanelDefaults from './PanelDefaults';
import {
  getColorForValue,
  getColorByXPercentage,
} from './Color';

class DiagramCtrl extends MetricsPanelCtrl {
  constructor($scope, $injector, $sce, $http) {
    super($scope, $injector);
    _.defaults(this.panel, PanelDefaults);
    this.$http = $http;
    this.panel.graphId = `diagram_${this.panel.id}`;
    this.containerDivId = `container_${this.panel.graphId}`;
    this.$sce = $sce;
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.unitFormats = kbn.getUnitFormats();
    this.initializeMermaid();
  }

  initializeMermaid() {
    mermaidAPI.initialize(this.panel.init);
    mermaidAPI.parseError = this.handleParseError.bind(this);
  }

  handleParseError(err) {
    this.error = 'Failed to parse diagram definition';
    this.errorText = this.$sce.trustAsHtml(`<p>Diagram Definition:</p><pre>${err}</pre>`);
  }

  onInitEditMode() {
    this.addEditorTab('Diagram', diagramEditor, 2);
    this.addEditorTab('Display', displayEditor, 3);
    this.addEditorTab('Metric Composites', compositeEditor, 4);
  }

  onDataReceived(dataList) {
    this.series = dataList.map(this.seriesHandler.bind(this));

    const data = this.getValues();
    this.updateDiagram(data);
    this.svgData = data;
    this.render();
  }

  replaceMetricCharacters(metricName) {
    // a datasource sending bad data will have a type other than string, set it
    // to "MISSING_METRIC_TARGET" and return
    if (typeof metricName !== 'string') return 'DATASOURCE_SENT_INVALID_METRIC_TARGET';
    var replacedText = metricName.replace(/"|,|;|=|:|{|}/g, '_');
    for (var index in this.panel.metricCharacterReplacements) {
      var replacement = this.panel.metricCharacterReplacements[index];
      // start with a simple replacement
      var pattern = replacement.replacementPattern;
      // check if the pattern is empty
      if (pattern.length === 0) continue;
      // if it is a regex, convert
      if (pattern[0] === '/') {
        pattern = kbn.stringToJsRegex(replacement.replacementPattern);
      }
      replacedText = replacedText.replace(
        pattern,
        replacement.replaceWithText
      );
    }
    return replacedText;
  }

  seriesHandler(seriesData) {
    var alias = this.replaceMetricCharacters(seriesData.target);
    var series = new TimeSeries({
      datapoints: seriesData.datapoints,
      alias,
      unit: seriesData.unit,
    });
    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
    var datapoints = seriesData.datapoints || [];
    if (datapoints && datapoints.length > 0) {
      var last = datapoints[datapoints.length - 1][1];
      var from = this.range.from;
      if (last - from < -10000) {
        series.isOutsideRange = true;
      }
    }
    return series;
  } // End seriesHandler()

  addSeriesOverride(override) {
    this.panel.seriesOverrides.push(override || {});
  }

  removeSeriesOverride(override) {
    this.panel.seriesOverrides = _.without(this.panel.seriesOverrides, override);
    this.refresh();
  }

  addComposite(composite) {
    this.panel.composites.push(composite || {});
  }
  removeComposite(composite) {
    this.panel.composites = _.without(this.panel.composites, composite);
    this.refresh();
  }
  getSeriesNamesForComposites() {
    return _.map(this.$scope.ctrl.series, function (series) {
      return series.alias;
    });
  }

  addMetricToComposite(composite) {
    if (composite.metrics === undefined) {
      composite.metrics = [{}];
    } else {
      composite.metrics.push({});
    }
    this.refresh();
  }
  removeMetricFromComposite(composite, metric) {
    composite.metrics = _.without(composite.metrics, metric);
    this.refresh();
  }

  addMetricCharacterReplacement(replacement) {
    this.panel.metricCharacterReplacements.push(replacement || {
      replacementPattern: '',
      replaceWithText: '_',
    });
  }
  removeMetricCharacterReplacement(replacement) {
    this.panel.metricCharacterReplacements = _.without(this.panel.metricCharacterReplacements, replacement);
    this.refresh();
  }

  updateThresholds() {
    var thresholdCount = this.panel.thresholds.length;
    var colorCount = this.panel.colors.length;
    this.refresh();
  }

  changeColor(colorIndex, color) {
    this.panel.colors[colorIndex] = color;
  }

  removeColor(colorIndex) {
    this.panel.colors.splice(colorIndex, 1);
  }

  addColor() {
    this.panel.colors.push('rgba(255, 255, 255, 1)');
  }

  setUnitFormat(subItem) {
    this.panel.format = subItem.value;
    this.refresh();
  }

  clearDiagram() {
    $('#' + this.panel.graphId).remove();
    this.svg = {};
  }

  updateDiagram(data) {
    if (this.panel.content.length > 0) {
      const mode = this.panel.mode;
      const templatedURL = this.templateSrv.replace(this.panel.mermaidServiceUrl, this.panel.scopedVars);

      function updateDiagram_cont(_this, graphDefinition) {
        // substitute values inside "link text"
        // this will look for any composite prefixed with a # and substitute the value of the composite
        // if a series alias is found, in the form #alias, the value will be substituted
        // this allows link values to be displayed based on the metric
        graphDefinition = _this.substituteHashPrefixedNotation(graphDefinition, data);
        graphDefinition = _this.templateSrv.replaceWithText(graphDefinition);
        _this.diagramType = mermaidAPI.detectType(graphDefinition);
        var diagramContainer = $(document.getElementById(_this.containerDivId));

        var renderCallback = function (svgCode, bindFunctions) {
          if (svgCode === '') {
            diagramContainer.html('There was a problem rendering the graph');
          } else {
            diagramContainer.html(svgCode);
            bindFunctions(diagramContainer[0]);
          }
        };
        // if parsing the graph definition fails, the error handler will be called but the renderCallback() may also still be called.
        mermaidAPI.render(_this.panel.graphId, graphDefinition, renderCallback);
      }

      if (mode == 'url') {
        var _this = this;
        this.$http({
          method: 'GET',
          url: templatedURL,
          headers: { 'Accept': 'text/x-mermaid,text/plain;q=0.9,*/*;q=0.8' },
        }).then(function successCallback(response) {
          // the response must have text/plain content-type
          // console.info(response.data);
          updateDiagram_cont.call(_this, response.data);
        }, function errorCallback(response) {
          console.warn('error', response);
        });
      } else {
        updateDiagram_cont(this, this.panel.content);
      }
    }
  } // End updateDiagram()


  /**
   * substitute values inside "link text"
   * this will look for any composite prefixed with a #|!|@|& and substitute the value of the composite
   * if a series alias is found, in the form #alias, the value will be substituted
   * this allows link values to be displayed based on the metric
   *
   * Prefix Modifier For Composites
   *   # Raw Value of Series
   *   ! Raw Value plus Metric Name
   *   @ Formatted (Decimal Limited and Unit Format)
   *   & Formatted (Decimal Limited, Unit Format, and Metric Name)
   *
   * Prefix Modifier For Series
   *   # Raw Value of Series
   *   @ Formatted (Decimal Limited and Unit Format)
   *
   * @param  {[String]} graphDefinition [Content of Graph Definition Markdown]
   * @param  {[Array]} data [Series Data]
   * @return {[String]} [Modified Graph Definition]
   */
  substituteHashPrefixedNotation(graphDefinition, data) {
    // inspect the string, locate all # prefixed items, and replace them with the value
    // of the series. If no matching series is found, leave it alone
    var matches = graphDefinition.match(/(?:#|!|@|&)(\w+)/g);
    if (matches === null) return graphDefinition;
    // check if there is a composite with a matching name
    for (var i = 0; i < matches.length; i++) {
      var aMatch = matches[i];
      var valueType = aMatch[0];
      aMatch = aMatch.substring(1);
      // check composites first
      for (var j = 0; j < this.panel.composites.length; j++) {
        var aComposite = this.panel.composites[j];
        if (aComposite.name === aMatch) {
          // found matching composite, get the valueFormatted
          var displayedValue = null;
          switch (valueType) {
            case '#':
              displayedValue = data[aComposite.name].value;
              graphDefinition = graphDefinition.replace('#' + aMatch, displayedValue);
              break;
            case '!':
              displayedValue = data[aComposite.name].valueRawFormattedWithPrefix;
              graphDefinition = graphDefinition.replace('!' + aMatch, displayedValue);
              break;
            case '@':
              displayedValue = data[aComposite.name].valueFormatted;
              graphDefinition = graphDefinition.replace('@' + aMatch, displayedValue);
              break;
            case '&':
              displayedValue = data[aComposite.name].valueFormattedWithPrefix;
              graphDefinition = graphDefinition.replace('&' + aMatch, displayedValue);
              break;
          }
        }
      }
      // next check series
      for (var k = 0; k < this.series.length; k++) {
        var seriesItem = this.series[k];
        if (seriesItem.alias === aMatch) {
          var displayedValue = null;
          switch (valueType) {
            case '#':
              displayedValue = data[seriesItem.alias].value;
              graphDefinition = graphDefinition.replace('#' + aMatch, displayedValue);
              break;
            case '@':
              displayedValue = data[seriesItem.alias].valueFormatted;
              graphDefinition = graphDefinition.replace('@' + aMatch, displayedValue);
              break;
          }
        }
      }
    }
    return graphDefinition;
  }

  renderDiagram(data, graphDefinition) {
    graphDefinition = this.templateSrv.replace(graphDefinition);
    this.diagramType = mermaidAPI.detectType(graphDefinition);
    var diagramContainer = $(document.getElementById(this.containerDivId));

    var renderCallback = function (svgCode, bindFunctions) {
      if (svgCode === '') {
        diagramContainer.html('There was a problem rendering the graph');
      } else {
        diagramContainer.html(svgCode);
        bindFunctions(diagramContainer[0]);
      }
    };
    // if parsing the graph definition fails, the error handler will be called
    // but the renderCallback() may also still be called.
    mermaidAPI.render(this.panel.graphId, graphDefinition, renderCallback);
    this.svgData = data;
    this.render();
  }


  getValues() {
    const data = this.series.reduce((acc, seriesItem) => {
      const initalValues = this.applyOverrides(seriesItem.alias);
      const lastPoint = _.last(seriesItem.datapoints);
      const lastValue = _.isArray(lastPoint) ? lastPoint[0] : null;

      const value = (this.panel.valueName === 'name' || _.isString(lastValue)) ?
        0 :
        seriesItem.stats[initialValues.valueName];

      const decimalInfo = this.getDecimalsForValue(data[seriesItem.alias].value);
      const valueRounded = (this.panel.valueName === 'name' || _.isString(lastValue)) ?
        0 :
        kbn.roundValue(value, decimalInfo.decimals);

      const formatFunc = _.isString(lastValue) ? val => _.escape(val) :
        kbn.valueFormats[initialValues.format];
      const valueFormated = this.panel.valueName === 'name' ? seriesItem.alias : formatFunc(value, decimalInfo.decimals, decimalInfo.scaledDecimals);

      const colorFunc = this.panel.legend.gradient.enabled ? this.getGradientForValue : getColorForValue;
      const color = colorFunc(res.colorData, res.Value);

      const seriesOutput = Object.assign({}, initalValues, {
        value,
        valueRounded,
        valueFormated,
        color,
      });


      return Object.assign({}, acc, {
        [seriesItem.alias]: seriesOutput,
      }
r   }, {});


    // TODO: Got to here 2018-06-16

    // now add the composites to data
    for (var i = 0; i < this.panel.composites.length; i++) {
      var aComposite = this.panel.composites[i];
      var currentWorstSeries = null;
      var currentWorstSeriesName = null;
      for (var j = 0; j < aComposite.metrics.length; j++) {
        var aMetric = aComposite.metrics[j];
        var seriesName = aMetric.seriesName;
        // make sure we have a match
        if (!data.hasOwnProperty(seriesName)) continue;
        var seriesItem = data[seriesName];
        // add the name of the series Item
        seriesItem.nameOfMetric = seriesName;
        // check colorData thresholds
        if (currentWorstSeries === null) {
          currentWorstSeries = seriesItem;
          currentWorstSeriesName = seriesItem.nameOfMetric;
        } else {
          currentWorstSeries = this.getWorstSeries(currentWorstSeries, seriesItem);
          currentWorstSeriesName = currentWorstSeries.nameOfMetric;
        }
        delete seriesItem.nameOfMetric;
      }
      // Prefix the valueFormatted with the actual metric name
      if (currentWorstSeries !== null) {
        currentWorstSeries.valueFormattedWithPrefix = currentWorstSeriesName + ': ' + currentWorstSeries.valueFormatted;
        currentWorstSeries.valueRawFormattedWithPrefix = currentWorstSeriesName + ': ' + currentWorstSeries.value;
        // currentWorstSeries.valueFormatted = currentWorstSeriesName + ': ' + currentWorstSeries.valueFormatted;
        // now push the composite into data
        data[aComposite.name] = currentWorstSeries;
      }
    }
  } // End setValues()

  getWorstSeries(series1, series2) {
    var worstSeries = series1;
    var series1thresholdLevel = this.getThresholdLevel(series1);
    var series2thresholdLevel = this.getThresholdLevel(series2);
    console.log('Series1 threshold level: ' + series1thresholdLevel);
    console.log('Series2 threshold level: ' + series2thresholdLevel);
    if (series2thresholdLevel > series1thresholdLevel) {
      // series2 has higher threshold violation
      worstSeries = series2;
    }
    return worstSeries;
  }

  // returns level of threshold, 0 = ok, 1 = warnimg, 2 = critical
  getThresholdLevel(series) {
    // default to ok
    var thresholdLevel = 0;
    var value = series.value;
    var thresholds = series.colorData.thresholds;
    // if no thresholds are defined, return 0
    if (thresholds === undefined) {
      return thresholdLevel;
    }
    // make sure thresholds is an array of size 2
    if (thresholds.length !== 2) {
      return thresholdLevel;
    }
    if (value >= thresholds[0]) {
      // value is equal or greater than first threshold
      thresholdLevel = 1;
    }
    if (value >= thresholds[1]) {
      // value is equal or greater than second threshold
      thresholdLevel = 2;
    }
    return thresholdLevel;
  }

  getGradientForValue(data, value) {
    var min = Math.min.apply(Math, data.thresholds);
    var max = Math.max.apply(Math, data.thresholds);
    var absoluteDistance = max - min;
    var valueDistanceFromMin = value - min;
    var xPercent = valueDistanceFromMin / absoluteDistance;
    // Get the smaller number to clamp at 0.999 max
    xPercent = Math.min(0.999, xPercent);
    // Get the larger number to clamp at 0.001 min
    xPercent = Math.max(0.001, xPercent);
    if (data.invertColors) {
      xPercent = 1 - xPercent;
    }

    return getColorByXPercentage(this.canvas, xPercent);
  }

  applyOverrides(seriesItemAlias) {
    var seriesItem = {},
      colorData = {},
      overrides = {};

    for (var i = 0; i <= this.panel.seriesOverrides.length; i++) {
      if (this.panel.seriesOverrides[i]) {
        var regex = kbn.stringToJsRegex(this.panel.seriesOverrides[i].alias);
        var matches = seriesItemAlias.match(regex);
        if (matches && matches.length > 0) {
          overrides = this.panel.seriesOverrides[i];
        }
      }
    }
    colorData.thresholds = (overrides.thresholds || this.panel.thresholds).split(',').map(function (strVale) {
      return Number(strVale.trim());
    });
    colorData.colorMap = this.panel.colors.slice();
    colorData.invertColors = overrides.invertColors || false;
    if (colorData.invertColors) {
      colorData.colorMap.reverse();
    }
    seriesItem.colorData = colorData;

    seriesItem.valueName = overrides.valueName || this.panel.valueName;

    seriesItem.format = overrides.unitFormat || this.panel.format;
    return seriesItem;
  }

  invertColorOrder() {
    this.panel.colors.reverse();
    this.refresh();
  }

  getDecimalsForValue(value) {
    // debugger;
    if (_.isNumber(this.panel.decimals)) {
      return {
        decimals: this.panel.decimals,
        scaledDecimals: null,
      };
    }

    var delta = value / 2;
    var dec = -Math.floor(Math.log(delta) / Math.LN10);

    var magn = Math.pow(10, -dec),
      norm = delta / magn, // norm is between 1.0 and 10.0
      size;

    if (norm < 1.5) {
      size = 1;
    } else if (norm < 3) {
      size = 2;
      // special case for 2.5, requires an extra decimal
      if (norm > 2.25) {
        size = 2.5;
        ++dec;
      }
    } else if (norm < 7.5) {
      size = 5;
    } else {
      size = 10;
    }

    size *= magn;

    // reduce starting decimals if not needed
    if (Math.floor(value) === value) {
      dec = 0;
    }

    var result = {};
    result.decimals = Math.max(0, dec);
    result.scaledDecimals = result.decimals - Math.floor(Math.log(size) / Math.LN10) + 2;

    return result;
  }

  link(scope, elem, attrs, ctrl) {
    var templateSrv = this.templateSrv;
    var diagramElement = elem.find('.diagram');
    diagramElement.append('<div id="' + ctrl.containerDivId + '"></div>');
    var diagramContainer = $(document.getElementById(ctrl.containerDivId));
    elem.css('height', ctrl.height + 'px');

    var canvas = elem.find('.canvas')[0];
    ctrl.canvas = canvas;
    var gradientValueMax = elem.find('.gradient-value-max')[0];
    var gradientValueMin = elem.find('.gradient-value-min')[0];

    function render() {
      setElementHeight();
      updateCanvasStyle();
      updateStyle();
    }

    function updateCanvasStyle() {
      canvas.width = Math.max(diagramElement[0].clientWidth, 100);
      var canvasContext = canvas.getContext('2d');
      canvasContext.clearRect(0, 0, canvas.width, canvas.height);

      var grd = canvasContext.createLinearGradient(0, 0, canvas.width, 0);
      var colorWidth = 1 / Math.max(ctrl.panel.colors.length, 1);
      for (var i = 0; i < ctrl.panel.colors.length; i++) {
        var currentColor = ctrl.panel.colors[i];
        grd.addColorStop(Math.min(colorWidth * i, 1), currentColor);
      }
      canvasContext.fillStyle = grd;
      canvasContext.fillRect(0, 0, canvas.width, 3);
      ctrl.canvasContext = canvasContext;

      gradientValueMax.innerText = Math.max.apply(Math, ctrl.panel.thresholds.split(','));
      gradientValueMin.innerText = Math.min.apply(Math, ctrl.panel.thresholds.split(','));
    }


    function setElementHeight() {
      // diagramContainer.css('height', ctrl.height + 'px');
    }

    this.events.on('render', function () {
      render();
      ctrl.renderingCompleted();
    });

    function updateStyle() {
      var data = ctrl.svgData;
      ctrl.svgData = {}; // get rid of the data after consuming it. This prevents adding duplicate DOM elements
      var svg = $(document.getElementById(ctrl.panel.graphId));
      $(svg).css('min-width', $(svg).css('max-width'));
      if (ctrl.panel.maxWidth) {
        $(svg).css('max-width', '100%');
      }

      if (svg[0] === undefined) {
        return;
      }

      for (var key in data) {
        var seriesItem = data[key];

        // Find nodes by ID if we can
        // console.info('finding targetElement');
        var targetElement = d3.select(svg[0].getElementById(key)); // $(svg).find('#'+key).first(); // jquery doesnt work for some ID expressions [prometheus data]

        if (targetElement[0][0] !== null) { // probably a flowchart
          targetElement.selectAll('rect,circle,polygon').style('fill', seriesItem.color);

          var div = targetElement.select('div');
          var fo = targetElement.select('foreignObject');
          // make foreign object element taller to accomdate value in FireFox/IE
          fo.attr('height', 45);
          // Add value text
          var p = div.append('p');
          p.classed('diagram-value');
          p.style('background-color', seriesItem.color);
          p.html(seriesItem.valueFormatted);
        } else {
          // maybe a flowchart with an alias text node
          targetElement = $(svg).find('div:contains("' + key + '")').filter(function () {
            // Matches node name ( 'foo' in both 'foo' and 'foo[bar]')
            return $(this).attr('id') === key;
          });
          if (targetElement.length > 0) {
            targetElement.parents('.node').find('rect, circle, polygon').css('fill', seriesItem.color);
            // make foreign object element taller to accomdate value in FireFox/IE
            targetElement.parents('.node').find('foreignObject').attr('height', 45);
            // for edge matches
            var edgeElement = targetElement.parent().find('.edgeLabel');
            if (edgeElement.length > 0) {
              edgeElement.css('background-color', 'transparent');
              edgeElement.append('<br/>' + seriesItem.valueFormatted).addClass('diagram-value');
              edgeElement.parent('div').css('text-align', 'center').css('background-color', seriesItem.color);
            } else {
              var dElement = d3.select(targetElement[0]);
              // Add value text
              var p = dElement.append('p');
              p.classed('diagram-value');
              p.style('background-color', seriesItem.color);
              p.html(seriesItem.valueFormatted);
            }
          } else {
            targetElement = $(svg).find('text:contains("' + key + '")'); // sequence diagram, gantt ?
            if (targetElement.length === 0) {
              continue;
            }
            // for node matches
            targetElement.parent().find('rect, circle, polygon').css('fill', seriesItem.color);
            targetElement.append('\n' + seriesItem.valueFormatted);
          }
        }
      }
      // return $(svg).html();
    } // End updateStyle()
  }
  // End Class
}


DiagramCtrl.templateUrl = 'module.html';

export {
  DiagramCtrl,
  DiagramCtrl as MetricsPanelCtrl,
};
