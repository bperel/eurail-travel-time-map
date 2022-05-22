let MAX_TIME = 1000 * 60;

let travelTimes;
let computeTravelTimes = () => {
  const linesIncludingStartStation = Object.values(lines)
    .filter(({stations}) => stations.includes(homeStationId))
  travelTimes = {};
  for (const station of Object.keys(stations)) {
    travelTimes[station] = station === homeStationId ? 0 : linesIncludingStartStation
      .filter(({stations}) => stations.includes(station))
      .reduce((acc, {time}) => Math.min(time, acc), MAX_TIME);
  }

  window.travelTimes = travelTimes;
  window.stationPositions = computeStationPositions(homeStationId, travelTimes)
  setStationPositions();
}
