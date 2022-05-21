let width = 500;
let height = 500;

let svg = d3.select("body").append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);
let container = svg.append('g');

let zoomed = () => {
  container.attr("transform", d3.event.transform);
  container.selectAll('.stop').attr('r', (2.0 / d3.event.transform.k));
  container.selectAll('.home').attr('r', (3.0 / d3.event.transform.k));
}
let zoom = d3.zoom()
  .scaleExtent([0.7, 5])
  .on("zoom", zoomed);
svg.call(zoom);

let maxTravelTime = 70 * 60;
let hourLineSvgSize = 60 * 60 / maxTravelTime * width;

let createHourCircle = (href) =>
  container.append("image")
    .attr("xlink:href", href)
    .attr("x", (width - hourLineSvgSize) / 2)
    .attr("y", (height - hourLineSvgSize) / 2)
    .attr("width", hourLineSvgSize)
    .attr("height", hourLineSvgSize)

let hourCircleBlank = createHourCircle('OneHourWithoutLabel.svg');
let hourCircle = createHourCircle('OneHour.svg').attr('opacity', 0);

let lines
let stations

Papa.parse("/schedules/Stations.csv", {
  download: true,
  header: true,
  complete: ({data}) => {
    stations = data
      .filter(line => !!line.Name)
      .reduce((acc, {Name, X, Y}) => ({...acc, [Name]: {name: Name, lat: X, lon: Y}}), {})
    Papa.parse("/schedules/Routes_train.csv", {
      download: true,
      header: true,
      complete: ({data}) => {
        lines = data
          .filter(line => !!line.Name && line.Name.indexOf('Tartu') === -1 && line.Name.indexOf('Daugavpils') === -1)
          .map(line => ({...line, Name: line.Name.replace(/Hilsinki/, 'Helsinki')}))
          .map(line => ({...line, Name: line.Name.replace(/Carania/, 'Catania')}))
          .map(line => ({...line, Name: line.Name.replace(/Sevilla/, 'Seville')}))
          .map(line => ({...line, Name: line.Name.replace(/Warzaw/, 'Warsaw')}))
          .map(line => ({...line, Name: line.Name.replace(/Klaipèda/u, 'Klaipėda')}))
          .map(line => ({...line, Name: line.Name.replace(/Gdansk/, 'Gdańsk')}))
          .reduce((acc, {gid,Name,description}) => ({...acc, [`train-${gid}`]: {name: `train-${gid}`, stations: Name.split(" - ")}}), {})
        updateMap(null, null);
      }
    })
  }
})

window.travelTimes = null;

let defaultStop = 'Westport';

let computeStationPositions = (originStationId, travelTimes) => {
  console.log(originStationId)
  console.log(defaultStop)
  let originLat = stations[originStationId || defaultStop].lat;
  let originLon = stations[originStationId || defaultStop].lon;

  let positions = {};
  for (let stationId of Object.keys(stations)) {
    let {lat, lon} = stations[stationId];

    let deltaY = lat - originLat;
    let deltaX = (lon - originLon) * 0.767;
    let angle = Math.atan2(deltaY, deltaX) + 30 / 180 * Math.PI;
    let origDist = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));

    let dist = travelTimes ? (travelTimes[stationId]) / maxTravelTime : origDist * 5;
    positions[stationId] = {x: Math.cos(angle) * dist, y: Math.sin(angle) * dist};
  }

  return positions;
}

let tooltip = $('#tooltip')

let shouldHideTooltip = true;
let addClickHandlers = (selection) =>
  selection.on('click', (d) => setHomeStationId(d)).on('mouseenter', (d) => {
    shouldHideTooltip = false;
    tooltip.css({top: `${d3.event.pageY + 10}px`, left: `${d3.event.pageX + 10}px`, display: 'block'});
    let innerHTML = `<strong>${stations[d].name}</strong><br/>`;
    if (travelTimes) {
      let minutesAway = (travelTimes[d] / 60 | 0);
      innerHTML += `${minutesAway} minutes away`;
    }
    tooltip.html(innerHTML);
  }).on('mouseleave', (d) => {
    shouldHideTooltip = true;
    setTimeout(() => {
      if (shouldHideTooltip) {
        tooltip.css({display: 'none'});
      }
    }, 100);
  })

let setStationPositions = (stationPositions) => {
  let xValue = (stationId) => stationPositions[stationId].x;
  let yValue = (stationId) => stationPositions[stationId].y;
  let xScale = d3.scaleLinear().range([0, width]).domain([-1, 1]);
  let yScale = d3.scaleLinear().range([height, 0]).domain([-1, 1]);
  let xMap = (x) => xScale(xValue(x));
  let yMap = (y) => yScale(yValue(y));
  let stationPositionIsReasonable = (stationId) => {
    let x = xValue(stationId);
    let y = yValue(stationId);
    return x > -5 && x < 5 && y > -5 && y < 5;
  }

  let lineFunc = d3.line().x(xMap).y(yMap).curve(d3.curveNatural);
  let createLine = (subwayLine) => lineFunc(subwayLine.stations.filter(stationPositionIsReasonable))

  let lineSelection = container.selectAll('.line').data(Object.values(lines));
  lineSelection.enter().append('path')
    .attr('class', 'line')
    .attr('stroke', (l) => l.color)
    .attr('stroke-width', 3)
    .merge(lineSelection)
    .transition()
    .attr('d', createLine)
    .attr('fill', 'none');

  let stopSelection = container.selectAll('.stop').data(Object.keys(stations));
  let merged = stopSelection.enter().append('circle').attr('class', 'stop').attr('r', '2').attr('fill', 'black').merge(stopSelection);
  merged.transition().attr('cx', xMap).attr('cy', yMap);
  addClickHandlers(merged);

  let homeSelection = container.selectAll('.home').data([1]);
  merged = homeSelection.enter().append('circle').attr('class', 'home').attr('r', '3').attr('fill', 'white').attr('stroke', 'black').attr('stroke-width', 2).merge(homeSelection);
  merged.transition().attr('cx', () => xScale(0)).attr('cy', () => yScale(0));
  addClickHandlers(merged);
}

let updateMap = (homeStationId, schedule) => {
  if (homeStationId) {
    hourCircleBlank.transition().attr('opacity', 0);
    hourCircle.transition().attr('opacity', 1);
    $('#initial').css({display: 'none'});
    $('#explanation').css({display: 'block'});
  }

  if (homeStationId && schedule) {
    computeTravelTimes(homeStationId, schedule, (times) => {
      window.travelTimes = times;
      setStationPositions(computeStationPositions(homeStationId, times));
    })
  } else {
    setStationPositions(computeStationPositions(null, null));
  }
}

window.homeStationId = null;
window.schedule = 'weekday_8am';

let setSchedule = (schedule) => {
  window.schedule = schedule;
  updateMap(window.homeStationId, window.schedule);
}
let setHomeStationId = (homeStationId) => {
  window.homeStationId = homeStationId;
  updateMap(window.homeStationId, window.schedule);
}

$(() =>
  $('#timePicker li').click((e) => {
    let schedule = e.target.getAttribute('data-schedule');
    $('#timePicker li').removeClass('selected');
    $(e.target).addClass('selected');
    setSchedule(schedule);
  }))
