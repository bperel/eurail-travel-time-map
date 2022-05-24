import './style.css'
import * as d3 from 'd3'
import jQuery from 'jquery'
import {getTravelTimes, MAX_TIME} from './virtual_rider'

const width = 500;
const height = 500;

const svg = d3.select("body").append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);
const container = svg.append('g');

const tooltip = jQuery('#tooltip');

const zoomed = () => {
  container.attr("transform", d3.event.transform);
  container.selectAll('.stop').attr('r', (2.0 / d3.event.transform.k));
  container.selectAll('.home').attr('r', (3.0 / d3.event.transform.k));
};

const zoom = d3.zoom()
  .scaleExtent([0.01, 1])
  .on("zoom", zoomed);
svg.call(zoom);

const maxTravelTime = 140 * 60;
const hourLineSvgSize = 2 * 60 * 60 / maxTravelTime * width;

const createHourCircle = (href) =>
  container.append("image")
    .attr("xlink:href", href)
    .attr("x", (width - hourLineSvgSize) / 2)
    .attr("y", (height - hourLineSvgSize) / 2)
    .attr("width", hourLineSvgSize)
    .attr("height", hourLineSvgSize);


const computeStationPositions = (originStationId, travelTimes) => {
  const originLat = stationsAndPorts[originStationId || defaultStop].lat;
  const originLon = stationsAndPorts[originStationId || defaultStop].lon;

  const positions = {};
  for (const stationId of Object.keys(stationsAndPorts)) {
    const {lat, lon} = stationsAndPorts[stationId];

    const deltaY = lat - originLat;
    const deltaX = (lon - originLon) * 0.767;
    const angle = Math.atan2(deltaY, deltaX) + 30 / 180 * Math.PI;
    const origDist = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));

    const dist = travelTimes ? (travelTimes[stationId]) / maxTravelTime : origDist * 5;
    positions[stationId] = {x: Math.cos(angle) * dist, y: Math.sin(angle) * dist};
  }

  return positions;
};


const setStationPositions = (stationPositions) => {
  const xValue = (stationId) => stationPositions[stationId].x;
  const yValue = (stationId) => stationPositions[stationId].y;
  const xScale = d3.scaleLinear().range([0, width]).domain([-1, 1]);
  const yScale = d3.scaleLinear().range([height, 0]).domain([-1, 1]);
  const xMap = (x) => xScale(xValue(x));
  const yMap = (y) => yScale(yValue(y));

  const lineFunc = d3.line().x(xMap).y(yMap).curve(d3.curveNatural);
  const createLine = (subwayLine) => lineFunc(subwayLine.stations);

  const lineSelection = container.selectAll('.line').data(Object.values(lines));
  lineSelection.enter().append('path')
    .attr('class', 'line')
    .attr('name', (l) => l.stations.join('-'))
    .attr('stroke', (l) => l.color)
    .attr('stroke-width', 3)
    .merge(lineSelection)
    .transition()
    .attr('d', createLine)
    .attr('fill', 'none');

  const stopSelection = container.selectAll('.stop').data(Object.keys(stationsAndPorts));
  let merged = stopSelection.enter().append('circle').attr('class', 'stop').attr('r', '2').attr('fill', 'black').merge(stopSelection);
  merged.transition().attr('cx', xMap).attr('cy', yMap);
  addClickHandlers(merged);

  const homeSelection = container.selectAll('.home').data([defaultStop]);
  merged = homeSelection.enter().append('circle').attr('class', 'home').attr('r', '3').attr('fill', 'white').attr('stroke', 'black').attr('stroke-width', 2).merge(homeSelection);
  merged.transition().attr('cx', () => xScale(0)).attr('cy', () => yScale(0));
  addClickHandlers(merged);
};

let travelTimes = null;
const updateMap = (homeStationId) => {
  hourCircleBlank.transition().attr('opacity', 0);
  hourCircle.transition().attr('opacity', 1);
  jQuery('#initial').css({display: 'none'});
  jQuery('#explanation').css({display: 'block'});

  travelTimes = getTravelTimes(homeStationId, graph, stationsAndPorts)
  const stationPositions = computeStationPositions(homeStationId, travelTimes)
  setStationPositions(stationPositions);
}


let shouldHideTooltip = true;
const addClickHandlers = (selection) =>
  selection.on('click', (d) => updateMap(d)).on('mouseenter', (d) => {
    shouldHideTooltip = false;
    tooltip.css({top: `${d3.event.pageY + 10}px`, left: `${d3.event.pageX + 10}px`, display: 'block'});
    let innerHTML = `<strong>${stationsAndPorts[d].name}</strong><br/>`;
    let minutesAway = (travelTimes[d] / 60 | 0);
    if (minutesAway === MAX_TIME / 60) {
      tooltip.html(`${innerHTML} Very far away`);
      return
    }
    const hoursAway = Math.floor(minutesAway / 60);
    minutesAway -= hoursAway * 60
    if (hoursAway) {
      innerHTML += `${hoursAway} hours `
    }
    if (minutesAway) {
      innerHTML += `${minutesAway} minutes `
    }
    tooltip.html(`${innerHTML} ${hoursAway || minutesAway ? 'away' : ''}`);
  }).on('mouseleave', () => {
    shouldHideTooltip = true;
    setTimeout(() => {
      if (shouldHideTooltip) {
        tooltip.css({display: 'none'});
      }
    }, 100);
  });

const hourCircleBlank = createHourCircle('TwoHoursWithoutLabel.svg');
const hourCircle = createHourCircle('TwoHours.svg').attr('opacity', 0);

let stationsAndPorts
let lines
let graph

const addStations = (data) => {
  stationsAndPorts = {
    ...stationsAndPorts, ...(data.filter(line => !!line.Name)
      .reduce((acc, {Name, X, Y}) => ({...acc, [Name]: {name: Name, lat: Y, lon: X}}), {}))
  }
}

const addLines = (data, prefix) => {
  lines = {
    ...lines, ...(data
      .filter(line => !!line.Name && !!line.description && line.Name.indexOf('Tartu') === -1 && line.Name.indexOf('Daugavpils') === -1)
      .map(line => ({...line, Name: line.Name.replace(/Hilsinki/, 'Helsinki')}))
      .map(line => ({...line, Name: line.Name.replace(/Carania/, 'Catania')}))
      .map(line => ({...line, Name: line.Name.replace(/Sevilla/, 'Seville')}))
      .map(line => ({...line, Name: line.Name.replace(/Warzaw/, 'Warsaw')}))
      .map(line => ({...line, Name: line.Name.replace(/Klaipèda/u, 'Klaipėda')}))
      .map(line => ({...line, Name: line.Name.replace(/Gdansk/, 'Gdańsk')}))
      .reduce((acc, {gid, Name, description}) => ({
        ...acc,
        [`${prefix}-${gid}`]: {
          name: `${prefix}-${gid}`,
          stations: Name.split(" - "),
          color: prefix === 'train' ? 'red' : 'blue',
          time: description.match(/(\d+)hr(?: (\d+) *min)?/).reduce(
            (acc, value, idx) =>
              acc + (idx && value ? parseInt(value) * Math.pow(60, (1 + (2 - idx))) : 0),
            0
          )
        }
      }), {}))
  }
}

d3.csv("schedules/Stations.csv", (stations) => {
  addStations(stations)
  d3.csv("schedules/Ports.csv", (ports) => {
    addStations(ports)
    d3.csv("schedules/Routes_train.csv", (trainRoutes) => {
      addLines(trainRoutes, 'train')
      d3.csv("schedules/Router_ferry.csv", (ferryRoutes) => {
        addLines(ferryRoutes, 'ferry')

        graph = Object.values(lines).reduce((acc, {stations: [station1, station2], time}) => ({
          ...acc,
          [station1]: {...(acc[[station1]] || {}), [station2]: (time)}
        }), {})
        for (const [station1, stations2] of Object.entries(graph)) {
          for (const [station2, time] of Object.entries(stations2)) {
            if (!graph[station2]) {
              graph[station2] = {}
            }
            if (!graph[station2][station1]) {
              graph[station2][station1] = time
            }
          }
        }
        updateMap(defaultStop);
      })
    })
  })
})

const defaultStop = 'Westport';
