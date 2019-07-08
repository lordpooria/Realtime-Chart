import React, { Component } from "react";
import { View, Dimensions } from "react-native";
import Svg, {
  Polyline,
  G,
  Path,
  Circle,
  Text,
  Rect,
  Line,
  Image as SvgImage
} from "react-native-svg";

const { width, height } = Dimensions.get("window");

let vertiLine = [];
let horizLine = [];
let speedText = [];
let chartHeight = height / 2;

const chartWidth = width / 2;
const heightPadding = 0.0 * height;
const widthPadding = 0.0 * width;
for (let i = 1; i < 6; i++) {
  let point = (i * chartWidth) / 6 + widthPadding;
  vertiLine.push(point);
}
for (let i = 1; i < 4; i++) {
  let point = (i * chartHeight) / 4 + heightPadding / 5;
  horizLine.push(point);
}
for (let i = 3; i > 0; i--) {
  let point = {
    x: 0.02 * width,
    y: (i * chartHeight) / 4 + 0.02 * chartHeight
  };
  speedText.push(point);
}

const CHART_POINTS_NUM = 360; //6min (100ms) : 10*60*6
const TIME_TO_UPDATE = 1500;
const UPDATE_PER_MS = 1000;
const INPUT_STREAM_PER_MS = 100;
const SAFTY = 2; //each can must have 1 points of prev can for the sake of continuous chart
const TIMER = 50;
const VISIBLE_CANVAS_NUM = 18;
const CANVAS_NUM = 36;
let canvasPool = [];
for (let i = 0; i < CANVAS_NUM; i++) {
  canvasPool.push(i);
}

export default class RealTimeChart extends Component {
  constructor(props) {
    super(props);

    let d = "M 0 0";
    //setting path pool points
    let canItemState = {};
    for (let i = 0; i < CANVAS_NUM; i++) {
      canItemState[`points${i}`] = "";
    }
    this.state = {
      isAccessible: true,
      bluetoothDataReceived: [],
      speedTxt: [1, 2, 3],
      shift: 0,
      ...canItemState
    };

    this.textPoints = [];
    this.speedArray = [];
    this.maxSpeed = 0.1;
    this.maxChart = 0.1;
    this.updateChartTimer = 0;
    this.chartTimer = 0;
    this.currentScene = 0;
    this.numShift = 0;
    this.setVertiLine = this.setVertiLine.bind(this);
    this.setHorizLine = this.setHorizLine.bind(this);
    // this.setTextSpeed = this.setTextSpeed.bind(this);
    // this.drawText = this.drawText.bind(this);
    this.createPool = this.createPool.bind(this);

    props.emitter.addListener("testEvent", data => {
      this.updateChartTimer = (this.updateChartTimer + 1) % CHART_POINTS_NUM;
      if (this.maxSpeed < data) {
        this.maxSpeed = data;
      }
      if (this.speedArray.length >= CHART_POINTS_NUM) {
        this.numShift++;
      }
      if (this.speedArray.length >= CHART_POINTS_NUM) {
        this.speedArray.shift();
        this.speedArray[CHART_POINTS_NUM - 1] = data;
      } else this.speedArray.push(data);
    });
  }

  componentDidMount() {
    this.textPoints = [];
    this.interval = setInterval(() => {
      let dataLen = this.speedArray.length;
      if (dataLen > 0) this.setChart(dataLen);
    }, UPDATE_PER_MS);
  }

  render() {
    return (
      <Svg width="100%" height="100%" viewbox={`0 0 ${width} ${chartHeight}`}>
        {vertiLine.map(this.setVertiLine)}
        {horizLine.map(this.setHorizLine)}
        <G x={(this.state.shift * chartWidth) / CHART_POINTS_NUM}>
          {canvasPool.map(this.createPool)}
        </G>
      </Svg>
    );
  }

  setChart = dataLen => {
    this.chartTimer++;

    //check and set maximum
    if (this.updateChartTimer % 50 === 0) {
      this.maxSpeed = Math.ceil(Math.max(...this.speedArray) / 4) * 4;
      if (this.maxSpeed < 4) this.maxSpeed = 4;
      if (this.maxChart !== Math.ceil(this.maxSpeed / 4) * 4) {
        this.updateChartTimer = 1;
      }
    }

    // TODO ---> edit and optimise this
    /// check and set Text of chart in ragard to chart max change
    if (this.maxChart !== Math.ceil(this.maxSpeed / 4) * 4) {
      this.maxChart = Math.ceil(this.maxSpeed / 4) * 4;
      this.setState({
        speedTxt: [
          parseInt(this.maxChart / 4),
          parseInt(this.maxChart / 2),
          parseInt((3 * this.maxChart) / 4)
        ]
      });

      let updateChartPoint = "";

      let canvasStep = CHART_POINTS_NUM / VISIBLE_CANVAS_NUM;
      let newState = {};
      let visibleCanvasNum = 0;

      if (dataLen < CHART_POINTS_NUM) {
        //before full width fill of chart
        visibleCanvasNum = Math.ceil(dataLen / canvasStep);
      } else {
        //after full width fill of chart and chart moving
        visibleCanvasNum = VISIBLE_CANVAS_NUM;
        newState[`shift`] = 0;
      }

      for (let i = 0; i < visibleCanvasNum; i++) {
        updateChartPoint = "";
        for (
          let j = i * canvasStep;
          j <= (i + 1) * canvasStep + 1 && j < dataLen;
          j++
        ) {
          updateChartPoint += `${widthPadding +
            (chartWidth * j) / CHART_POINTS_NUM},${chartHeight *
            (1 - this.speedArray[j] / this.maxChart) +
            heightPadding / 5} `;
        }
        newState[`points${i}`] = updateChartPoint;
      }

      for (let i = visibleCanvasNum; i < canvasPool.length; i++) {
        newState[`points${i}`] = "";
      }

      this.setState(newState);
      this.currentScene = visibleCanvasNum;
      return;
    }

    let updateChartPoint = "";
    if (!this.goToNextPool())
      updateChartPoint = this.state[`points${this.currentScene}`];

    if (dataLen < CHART_POINTS_NUM) {
      for (
        let i = dataLen - UPDATE_PER_MS / INPUT_STREAM_PER_MS - SAFTY;
        i < dataLen;
        i++
      ) {
        updateChartPoint += `${widthPadding +
          (chartWidth * i) / CHART_POINTS_NUM},${chartHeight *
          (1 - this.speedArray[i] / this.maxChart) +
          heightPadding / 5} `;
      }
      this.setChartState(this.currentScene, updateChartPoint);
    } else {
      let shifted = this.state.shift;
      for (
        let i = dataLen - UPDATE_PER_MS / INPUT_STREAM_PER_MS - SAFTY;
        i < dataLen;
        i++
      ) {
        updateChartPoint += `${widthPadding +
          (chartWidth * (i - shifted + this.numShift)) /
            CHART_POINTS_NUM},${chartHeight *
          (1 - this.speedArray[i] / this.maxChart) +
          heightPadding / 5} `;
      }
      this.setChartState(this.currentScene, updateChartPoint);
      this.setState(prevState => ({ shift: prevState.shift - this.numShift }));
      this.numShift = 0;
    }
  };

  createPool(item, index) {
    return (
      <Polyline
        key={index}
        points={this.state[`points${item}`]}
        strokeWidth="2"
        fill="transparent"
        stroke="white"
      />
    );
  }

  setVertiLine(value, index) {
    return (
      <Line
        key={index}
        x1={value}
        y1={0}
        x2={value}
        y2={chartHeight + (2 * heightPadding) / 5}
        stroke="#888"
      />
    );
  }

  setHorizLine(value, index) {
    return (
      <Line
        key={index}
        x1={widthPadding}
        y1={value}
        x2={chartWidth + widthPadding}
        y2={value}
        stroke="#888"
      />
    );
  }

  goToNextPool = () => {
    if (
      this.chartTimer %
        (CHART_POINTS_NUM /
          ((UPDATE_PER_MS / INPUT_STREAM_PER_MS) * VISIBLE_CANVAS_NUM)) ===
      0
    ) {
      this.currentScene++;
      if (this.currentScene >= canvasPool.length) {
        this.currentScene = 0;
      }
      return true;
    }
  };
  setChartState(index, updateChartPoint) {
    let canItemState = {};
    canItemState[`points${index}`] = updateChartPoint;
    this.setState(canItemState);
  }
}
