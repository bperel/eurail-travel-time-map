let MAX_TIME = 1000 * 60;

let travelTimes;
let computeTravelTimes = () => {
  travelTimes = {};
  for (const station of Object.keys(stations).filter(station => station !== homeStationId)) {
    travelTimes[station] = MAX_TIME;
  }
  const reachableStations = Object.keys(dijkstra.single_source_shortest_paths(graph, homeStationId));
  for (const reachableStation of reachableStations) {
    let pathSteps = dijkstra.find_path(graph, homeStationId, reachableStation);
    travelTimes[reachableStation] = pathSteps.reduce((acc, station, idx) => acc + (idx === 0? 0 : graph[pathSteps[idx - 1]][station]), 0)
  }

  window.travelTimes = travelTimes;
  window.stationPositions = computeStationPositions(homeStationId, travelTimes)
  setStationPositions();
}
