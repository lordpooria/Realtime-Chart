import React, { Component } from "react";
import { View, Text as NativeText, Dimensions } from "react-native";
import PropTypes from "prop-types";
import Svg, { Polyline, G, Path } from "react-native-svg";

class Bucket {
  path = "";
  isDrawn = false;
  refToSVG;
}

class BucketManager {
  constructor() {
    this.visibleBuckets = this.calculateBuckets();
    this.bucketSize = Math.ceil(360 / this.visibleBuckets);
    //setup buckets width 3 safty extra than visible bucket for drawing path
    for (let i = 0; i < this.visibleBuckets + 3; i++) {
      this.bucketsArray.push(new Bucket());
    }
  }
  visibleBuckets = 0;

  bucketSize = 0;

  currentBucket = 0;

  bucketsArray = [];

  calculateBuckets() {
    return 30;
  }

  nextBucket = (chartWindowSize, VISIBLE_BUCKETS_NUM, updateEachMS) => {
    console.log(this.currentBucket);
    if (
      this.chartTimer %
        (chartWindowSize / ((updateEachMS / 100) * VISIBLE_BUCKETS_NUM)) ===
      0
    ) {
      this.currentBucket++;
      if (this.currentBucket >= this.bucketsArray.length) {
        this.currentBucket = 0;
      }
      ///reset out of screen bucket Path
      const exitedBucketIndex =
        (this.currentBucket + this.visibleBuckets) % this.bucketsArray.length;
      
      this.bucketsArray[exitedBucketIndex].isDrawn = false;

      return true;
    }
  };
}

class RealTimeChart extends Component {
  chartTimer = 0;

  newAddedData = 0;

  maxY = 0.1;

  dataWindow = [];

  bucketManager = new BucketManager();

  pathsRef = [];

  lastDrawPoints = [];

  state = {
    width: 0,
    height: 0,
    shift: 0
  };

  __onLayout = event => {
    const {
      nativeEvent: {
        layout: { height, width }
      }
    } = event;

    this.setState({ height, width });
  };

  componentDidMount() {
    const { updateEachMS, chartWindowSize, dataListenerName } = this.props;

    this.addListener(
      dataListenerName,
      chartWindowSize,
      this.bucketManager.visibleBuckets,
      updateEachMS,
      this.state.width,
      this.state.height,
      this.state.shift
    );
  }

  componentWillUnmount() {
    clearInterval(this.drawInterval);
  }

  addListener = (
    dataListenerName,
    chartWindowSize,
    VISIBLE_BUCKETS_NUM,
    updateEachMS
  ) => {
    this.props.emitter.addListener(dataListenerName, data => {
      this.chartTimer++;

      this.newAddedData++;
      if (this.dataWindow.length >= chartWindowSize) {
        this.dataWindow.shift();
        this.dataWindow[chartWindowSize - 1] = data;
      } else this.dataWindow.push(data);

      if (this.maxY < data) {
        if (this.chartTimer % 10 === 0) {
          this.renderChart(true);
        } else if (this.chartTimer % 10 === 5) {
          const { width, height, shift } = this.state;
          this.maxY = data;
          this.resetUpdateChart(
            this.dataWindow.length,
            VISIBLE_BUCKETS_NUM,
            chartWindowSize,
            width,
            height
          );
        }
      } else {
        if (this.chartTimer % 10 === 0) {
          this.renderChart();
        } else if (this.chartTimer % 10 === 5) {
          const { width, height, shift } = this.state;
          this.updateChart(
            this.dataWindow.length,
            VISIBLE_BUCKETS_NUM,
            chartWindowSize,
            updateEachMS,
            width,
            height,
            shift
          );
        }
      }

      //each time it's render or calculate new chart data
    });
  };

  render() {
    const { style, chartWindowSize, children } = this.props;
    const { width, height, shift } = this.state;

    const extraProps = { width, height, dataWindow: this.dataWindow };
    return (
      <View style={style}>
        <View
          style={{ flex: 1, backgroundColor: "red" }}
          onLayout={this.__onLayout}
        >
          {height > 0 && width > 0 && (
            <Svg
              width={width}
              height={height}
              viewbox={`0 0 ${width} ${height}`}
            >
              {React.Children.map(children, child => {
                if (child) {
                  React.cloneElement(child, extraProps);
                }
              })}
              <G fill="red" x={(shift * width) / chartWindowSize}>
                {this.bucketManager.bucketsArray.map(this.createPool)}
              </G>
            </Svg>
          )}
        </View>
      </View>
    );
  }

  resetUpdateChart = (
    dataLen,
    VISIBLE_BUCKETS_NUM,
    chartWindowSize,
    width,
    height
  ) => {
    let updateChartPoint = "";

    let newState = {};
    let visibleBucketNum = 0;

    if (dataLen < chartWindowSize) {
      //before full width fill of chart
      visibleBucketNum = Math.ceil(dataLen / this.bucketManager.bucketSize);
    } else {
      //after full width fill of chart and chart moving
      visibleBucketNum = VISIBLE_BUCKETS_NUM;
      newState[`shift`] = 0;
    }

    for (let i = 0; i < visibleBucketNum; i++) {
      let j = i * this.bucketManager.bucketSize;
      let pathPoints = this.calcPathPoint(width, height, dataLen, j);

      updateChartPoint = `M ${pathPoints[0]},${pathPoints[1]}`;

      for (
        j;
        j <= (i + 1) * this.bucketManager.bucketSize + 1 && j < dataLen;
        j++
      ) {
        pathPoints = this.calcPathPoint(width, height, dataLen, j);
        updateChartPoint += `L ${pathPoints[0]},${pathPoints[1]}`;
      }

      this.updateBucketPath(
        this.bucketManager.bucketsArray[i],
        updateChartPoint
      );
    }

    for (let i = visibleBucketNum; i < this.bucketManager.bucketSize; i++) {
      this.updateBucketPath(this.bucketManager.bucketsArray[i], "");
    }

    this.setState(newState);
    this.bucketManager.currentBucket = visibleBucketNum;
  };

  updateChart = (
    dataLen,
    VISIBLE_BUCKETS_NUM,
    chartWindowSize,
    updateEachMS,
    width,
    height,
    shifted
  ) => {
    //check and set maximum
    // if (this.chartTimer % 50 === 0) {
    //   this.maxData = Math.ceil(Math.max(...this.dataWindow) / 4) * 4;
    //   if (this.maxY < 4) this.maxData = 4;
    //   if (this.maxChart !== Math.ceil(this.maxY / 4) * 4) {
    //   }
    // }
    const doesGoNext = this.bucketManager.nextBucket(
      chartWindowSize,
      VISIBLE_BUCKETS_NUM,
      updateEachMS
    );

    let index = dataLen - this.newAddedData;
    let pathPoints = this.calcPathPoint(width, height, dataLen, index);
    let updateChartPoint = "";

    if (!doesGoNext) {
      updateChartPoint = this.bucketManager.bucketsArray[
        this.bucketManager.currentBucket
      ].path;
    } else {
      updateChartPoint = `M ${pathPoints[0]},${pathPoints[1]}`;
    }

    // if (dataLen < chartWindowSize) {
    //   for (index; index < dataLen; index++) {
    //     pathPoints = this.calcPathPoint(width, height, dataLen, index);
    //     updateChartPoint += `L ${pathPoints[0]},${pathPoints[1]}`;
    //   }
    // } else {
    //   for (index; index < dataLen; index++) {
    //     pathPoints = this.calcPathPoint(
    //       width,
    //       height,
    //       dataLen,
    //       index - shifted + this.numShift
    //     );
    //     updateChartPoint += `L ${pathPoints[0]},${pathPoints[1]}`;
    //   }

    let shiftX = 0;
    if (dataLen >= chartWindowSize) {
      shiftX = shifted - this.newAddedData;
      this.setState(prevState => ({
        shift: prevState.shift - this.newAddedData
      }));
    }

    for (index; index < dataLen; index++) {
      pathPoints = this.calcPathPoint(width, height, dataLen, index - shiftX);
      updateChartPoint += `L ${pathPoints[0]},${pathPoints[1]}`;
    }

    this.updateBucketPath(
      this.bucketManager.bucketsArray[this.bucketManager.currentBucket],
      updateChartPoint
    );
    this.newAddedData = 0;
  };

  updateBucketPath(bucket, updateChartPoint) {
    bucket.path = updateChartPoint;
  }

  drawBucketPath(bucket) {
    bucket.refToSVG &&
      bucket.refToSVG.setNativeProps({
        d: bucket.path
      });
    bucket.isDrawn = true;
  }

  renderChart = reset => {
    this.bucketManager.bucketsArray.forEach(bucket => {
      if (reset) {
        this.drawBucketPath(bucket);
      } else if (!bucket.isDrawn) {
        this.drawBucketPath(bucket);
      }
    });
  };

  createPool = (item, index) => {
    return (
      <Path
        key={index}
        d=""
        strokeWidth="2"
        fill="transparent"
        stroke="white"
        ref={refs => (item.refToSVG = refs)}
      />
    );
  };

  calcPathPoint(width, height, chartWindowSize, index) {
    return [
      (width * index) / chartWindowSize,
      height * (1 - this.dataWindow[index] / this.maxY)
    ];
  }
}

RealTimeChart.propTypes = {
  chartWindowSize: PropTypes.number,
  updateEachMS: PropTypes.number,
  dataListenerName: PropTypes.string,
  style: PropTypes.any
};

RealTimeChart.defaultProps = {
  chartWindowSize: 100,
  updateEachMS: 1000,
  dataListenerName: "inputData",
  style: {}
};

export default RealTimeChart;
