
// let vertiLine = [];
// let horizLine = [];
// let speedText = [];
// this.maxChart = 0.1;

// for (let i = 1; i < 6; i++) {
//   let point = (i * width) / 6 + widthPadding;
//   vertiLine.push(point);
// }
// for (let i = 1; i < 4; i++) {
//   let point = (i * height) / 4 + heightPadding / 5;
//   horizLine.push(point);
// }

// setVertiLine(value, index) {
//     return (
//       <Line
//         key={index}
//         x1={value}
//         y1={0}
//         x2={value}
//         y2={height + (2 * heightPadding) / 5}
//         stroke="#888"
//       />
//     );
//   }

//   setHorizLine(value, index) {
//     return (
//       <Line
//         key={index}
//         x1={widthPadding}
//         y1={value}
//         x2={width + widthPadding}
//         y2={value}
//         stroke="#888"
//       />
//     );
//   }

//   this.setState({
//     speedTxt: [
//       parseInt(this.maxChart / 4),
//       parseInt(this.maxChart / 2),
//       parseInt((3 * this.maxChart) / 4)
//     ]
//   });
