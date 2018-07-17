const logLevels = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

export const PanelDefaults = {
  composites: [],
  metricCharacterReplacements: [],
  // other style overrides
  seriesOverrides: [],
  thresholds: '0,10',
  decimals: 2, // decimal precision
  colors: ['rgba(50, 172, 45, 0.97)', 'rgba(237, 129, 40, 0.89)', 'rgba(245, 54, 54, 0.9)'],
  legend: {
    show: true,
    min: true,
    max: true,
    avg: true,
    current: true,
    total: true,
    gradient: {
      enabled: true,
      show: true,
    },
  },
  maxDataPoints: 100,
  mappingType: 1,
  maxWidth: false,
  nullPointMode: 'connected',
  format: 'none',
  valueName: 'avg',
  valueOptions: ['avg', 'min', 'max', 'total', 'current'],
  valueMaps: [{
    value: 'null',
    op: '=',
    text: 'N/A',
  }],
  content: 'graph LR\n' +
    'A[Square Rect] -- Link text --> B((Circle))\n' +
    'A --> C(Round Rect)\n' +
    'B --> D{Rhombus}\n' +
    'C --> D\n',
  // mode determins whether an inline graph is used or a graph from a URL.
  // Valid options are 'content' and 'url'.
  mode: 'content',
  mermaidServiceUrl: '',
  init: {
    logLevel: logLevels.warn,
    // cloneCssStyles controls whether or not the css rules should be copied
    // into the generated svg.
    cloneCssStyles: false,
    // startOnLoad controls whether or mermaid starts when the page loads.
    startOnLoad: false,
    // arrowMarkerAbsolute controls whether or arrow markers in html code will
    // be absolute paths or an anchor, #. This matters if you are using base
    // tag settings.
    arrowMarkerAbsolute: true,
    flowchart: {
      htmlLabels: true,
      useMaxWidth: true,
    },
    sequenceDiagram: {
      // diagramMarginX controls the margin to the right and left of the
      // sequence diagram.
      diagramMarginX: 50,
      // diagramMarginY controls the margin above and below the sequence
      // diagram.
      diagramMarginY: 10,
      // actorMargin controls the margin between actors.
      actorMargin: 50,
      // width controls the width of actor boxes.
      width: 150,
      // height controls the height of actor boxes.
      height: 65,
      // boxMargin controls the margin around loop boxes.
      boxMargin: 10,
      // boxTextMargin controls the margin around text in the loop/alt/opt
      // boxes.
      boxTextMargin: 5,
      // noteMargin controls the margin around notes.
      noteMargin: 10,
      // messageMargin controls the space between messages.
      messageMargin: 35,
      // mirrorActors determines whether actors should be mirrored under the
      // diagram.
      mirrorActors: true,
      // bottomMarginAdj is used to prolong the edge of the diagram downwards.
      // This may need adjustment depending on CSS styling.
      bottomMarginAdj: 1,
      // useMaxWidth determines whether the width and height should set to an
      // absolute value or to 100%.
      useMaxWidth: true,
    },
    gantt: {
      // titleTopMargin sets the margin for the text above the gantt diagram
      titleTopMargin: 25,
      // barHeight sets the height of the bars in the graph
      barHeight: 20,
      // barGap sets the margin between the different activities in the gantt
      // diagram
      barGap: 4,
      // TODO: Confirm what topPadding does and write better docs for it.
      // topPadding sets the margin between the title, gantt diagram and axis.
      topPadding: 50,
      // leftPadding controls the space allocated for the section name to the
      // left of the activities.
      leftPadding: 75,
      // gridLineStartPadding sets the vertical starting position of the grid
      // lines.
      gridLineStartPadding: 35,
      // TODO: Font size where?
      // fontSize sets the font size
      fontSize: 11,
      // TODO: Font used where?
      // fontFamily sets the font used.
      fontFamily: '"Open-Sans", "sans-serif"',
      // numberSectionStyles sets the number of alternating section styles.
      numberSectionStyles: 3,
    },
  },
};

