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
  .scaleExtent([0.01, 1])
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

let stations
let lines
let graph

const addStations = (data) => {
  stations = {
    ...stations, ...(data.filter(line => !!line.Name)
      .reduce((acc, {Name, X, Y}) => ({...acc, [Name]: {name: Name, lat: Y, lon: X}}), {}))
  }
}

const addLines = (data, prefix) => {
  lines = {...lines, ...(data
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
        color: prefix === 'train' ? 'red': 'blue',
        time: description.match(/(\d+)hr(?: (\d+) *min)?/).reduce((acc, value, idx) => acc + (idx === 1 ? parseInt(value) * 3600 : (idx === 2 ? parseInt(value) * 60 : 0)), 0)
      }
    }), {}))}
}

d3.csv("/schedules/Stations.csv", (stations) => {
  addStations(stations)
  d3.csv("/schedules/Ports.csv", (ports) => {
    addStations(ports)
    d3.csv("/schedules/Routes_train.csv", (trainRoutes) => {
      addLines(trainRoutes, 'train')
      d3.csv("/schedules/Router_ferry.csv", (ferryRoutes) => {
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

window.travelTimes = null;

let defaultStop = 'Westport';

let computeStationPositions = (originStationId, travelTimes) => {
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

let setStationPositions = () => {
  let xValue = (stationId) => stationPositions[stationId].x;
  let yValue = (stationId) => stationPositions[stationId].y;
  let xScale = d3.scaleLinear().range([0, width]).domain([-1, 1]);
  let yScale = d3.scaleLinear().range([height, 0]).domain([-1, 1]);
  let xMap = (x) => xScale(xValue(x));
  let yMap = (y) => yScale(yValue(y));
  let stationPositionIsReasonable = (stationId) => {
    let x = xValue(stationId);
    let y = yValue(stationId);
    return true;//x > -5 && x < 5 && y > -5 && y < 5;
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

  let homeSelection = container.selectAll('.home').data([defaultStop]);
  merged = homeSelection.enter().append('circle').attr('class', 'home').attr('r', '3').attr('fill', 'white').attr('stroke', 'black').attr('stroke-width', 2).merge(homeSelection);
  merged.transition().attr('cx', () => xScale(0)).attr('cy', () => yScale(0));
  addClickHandlers(merged);
}

let updateMap = () => {
  hourCircleBlank.transition().attr('opacity', 0);
  hourCircle.transition().attr('opacity', 1);
  $('#initial').css({display: 'none'});
  $('#explanation').css({display: 'block'});

  computeTravelTimes()
}

window.homeStationId = defaultStop;
window.schedule = 'weekday_8am';

let setSchedule = (schedule) => {
  window.schedule = schedule;
  updateMap(window.homeStationId);
}
let setHomeStationId = (homeStationId) => {
  window.homeStationId = homeStationId;
  updateMap(window.homeStationId);
}

$(() =>
  $('#timePicker li').click((e) => {
    let schedule = e.target.getAttribute('data-schedule');
    $('#timePicker li').removeClass('selected');
    $(e.target).addClass('selected');
    setSchedule(schedule);
  }))
